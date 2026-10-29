package fr.jarvis.assistant.service

import android.Manifest
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.util.Log
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import fr.jarvis.assistant.Reglages
import fr.jarvis.assistant.commandes.ExecuteurCommandes
import fr.jarvis.assistant.stt.GestionModeles
import fr.jarvis.assistant.stt.Transcripteur
import fr.jarvis.assistant.tts.Synthese
import fr.jarvis.assistant.wake.DetecteurMotReveil
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.asCoroutineDispatcher
import kotlinx.coroutines.cancel
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Service au premier plan de type « microphone ».
 *
 * Il possède l'unique micro et orchestre le flux complet :
 *   VEILLE (mot de réveil) -> bip -> ECOUTE (jusqu'au silence) -> REFLEXION (commande)
 *   -> PAROLE (réponse vocale) -> VEILLE
 *
 * Toute la partie audio (lecture du micro + Vosk) tourne sur UN thread dédié :
 * aucun verrou n'est nécessaire sur le micro ni sur les reconnaisseurs.
 */
class JarvisService : Service() {

    private val portee = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val executeurAudio = Executors.newSingleThreadExecutor { r ->
        Thread(r, "jarvis-audio").apply { priority = Thread.MAX_PRIORITY }
    }
    private val threadAudio = executeurAudio.asCoroutineDispatcher()

    private lateinit var reglages: Reglages
    private lateinit var gestionModeles: GestionModeles
    private lateinit var synthese: Synthese
    private lateinit var executeur: ExecuteurCommandes
    private var bip: ToneGenerator? = null

    private var tacheMoteur: Job? = null
    @Volatile private var tacheReponse: Job? = null
    private val demandeEcoute = AtomicBoolean(false)
    @Volatile private var enPause = false
    private var premierPlan = false

    override fun onCreate() {
        super.onCreate()
        reglages = Reglages(this)
        gestionModeles = GestionModeles(this)
        synthese = Synthese(this)
        executeur = ExecuteurCommandes(this)
        bip = try {
            ToneGenerator(AudioManager.STREAM_NOTIFICATION, 80)
        } catch (e: RuntimeException) {
            null // certains appareils refusent : on se passe du bip
        }
        // La notification suit l'état (veille, écoute, pause…)
        portee.launch {
            EtatJarvis.infos
                .map { Triple(it.etat, it.enPause, it.messageErreur) }
                .distinctUntilChanged()
                .collect { if (premierPlan) Notifications.mettreAJourService(this@JarvisService, EtatJarvis.infos.value) }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_QUITTER) {
            quitter()
            return START_NOT_STICKY
        }
        // Les actions envoyées par startForegroundService() exigent un appel à startForeground()
        val viaPremierPlan = action == null || action == ACTION_DEMARRER || action == ACTION_ECOUTER
        if (viaPremierPlan || !premierPlan) {
            if (!passerAuPremierPlan()) {
                stopSelf()
                return START_NOT_STICKY
            }
        }
        when (action) {
            ACTION_PAUSE -> basculerPause()
            ACTION_TESTER_VOIX -> testerVoix()
            ACTION_RECHARGER -> demarrerMoteur(forcer = true)
            ACTION_ECOUTER -> {
                if (enPause) basculerPause()
                demarrerMoteur()
                demandeEcoute.set(true)
            }
            else -> demarrerMoteur()
        }
        // START_STICKY : Android relancera le service s'il est tué (si les restrictions le permettent)
        return START_STICKY
    }

    /**
     * Passe le service au premier plan avec le type « microphone ».
     * Android 12+ lève ForegroundServiceStartNotAllowedException si l'appli est en arrière-plan,
     * Android 14+ lève SecurityException si l'accès au micro n'est pas autorisé dans ce contexte.
     * Dans ces cas, on affiche une notification qui permet de relancer Jarvis d'un toucher.
     */
    private fun passerAuPremierPlan(): Boolean {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            Notifications.notifierDemarrage(this, "Autorisez le micro pour activer Jarvis.")
            return false
        }
        return try {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
            ServiceCompat.startForeground(this, Notifications.ID_SERVICE, Notifications.service(this, EtatJarvis.infos.value), type)
            premierPlan = true
            EtatJarvis.majServiceActif(true)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Démarrage au premier plan refusé", e)
            if (!premierPlan) Notifications.notifierDemarrage(this, "Touchez pour activer l'écoute de Jarvis.")
            premierPlan // déjà au premier plan : l'échec d'un nouvel appel n'est pas bloquant
        }
    }

    /** Lance (ou relance si [forcer]) le chargement du modèle puis la boucle audio. */
    private fun demarrerMoteur(forcer: Boolean = false) {
        if (tacheMoteur?.isActive == true && !forcer) return
        val precedente = tacheMoteur
        tacheMoteur = portee.launch {
            precedente?.cancelAndJoin()
            moteur()
        }
    }

    private suspend fun moteur() = withContext(threadAudio) {
        EtatJarvis.passerA(Etat.CHARGEMENT)
        val id = reglages.modeleId
        if (!gestionModeles.estInstalle(id)) {
            EtatJarvis.passerA(Etat.ERREUR, "Modèle vocal non installé : ouvrez Jarvis pour le télécharger.")
            return@withContext
        }
        val modele = try {
            gestionModeles.charger(id)
        } catch (e: Exception) {
            Log.e(TAG, "Chargement du modèle impossible", e)
            EtatJarvis.passerA(Etat.ERREUR, "Chargement du modèle impossible : ${e.message}")
            return@withContext
        }
        val micro = Micro()
        val detecteur = DetecteurMotReveil(modele)
        val transcripteur = Transcripteur(modele)
        try {
            EtatJarvis.passerA(Etat.VEILLE)
            boucleAudio(micro, detecteur, transcripteur)
        } finally {
            // Libération systématique, y compris en cas d'annulation
            micro.liberer()
            detecteur.close()
            transcripteur.close()
            modele.close()
            EtatJarvis.majNiveau(0f)
        }
    }

    /** Boucle principale : lit le micro par trames de 100 ms et les distribue selon l'état. */
    private suspend fun boucleAudio(micro: Micro, detecteur: DetecteurMotReveil, transcripteur: Transcripteur) {
        val tampon = ShortArray(Micro.TAILLE_TRAME)
        var ignorerJusqua = 0L
        var derniereVerification = 0L

        while (currentCoroutineContext().isActive) {
            // 1) Demande d'écoute manuelle (bouton « Parler », assistant système, notification)
            if (demandeEcoute.getAndSet(false) && !enPause) {
                if (EtatJarvis.etat == Etat.PAROLE || EtatJarvis.etat == Etat.REFLEXION) {
                    synthese.interrompre()
                    tacheReponse?.cancelAndJoin()
                }
                if (EtatJarvis.etat == Etat.VEILLE || EtatJarvis.etat == Etat.ERREUR) {
                    if (EtatJarvis.etat == Etat.ERREUR) EtatJarvis.passerA(Etat.VEILLE)
                    ignorerJusqua = commencerEcoute(detecteur, transcripteur)
                }
            }

            // 2) Le micro est-il nécessaire dans l'état courant ?
            if (enPause && EtatJarvis.etat == Etat.ECOUTE) EtatJarvis.passerA(Etat.VEILLE)
            val etat = EtatJarvis.etat
            val besoinMicro = !enPause && (etat == Etat.ECOUTE || (etat == Etat.VEILLE && reglages.motReveilActif))
            if (!besoinMicro) {
                micro.arreter() // le point vert de confidentialité disparaît
                if (EtatJarvis.infos.value.niveauMicro != 0f) EtatJarvis.majNiveau(0f)
                delay(100)
                continue
            }
            if (!micro.demarrer()) {
                micro.liberer()
                EtatJarvis.passerA(Etat.ERREUR, "Micro indisponible (utilisé par une autre application ?)")
                delay(3_000)
                EtatJarvis.passerA(Etat.VEILLE)
                continue
            }

            // 3) Lecture d'une trame (bloquante, 100 ms)
            val n = micro.lire(tampon)
            if (n <= 0) {
                Log.w(TAG, "Erreur de lecture micro : $n")
                micro.liberer()
                delay(200)
                continue
            }
            val niveau = Micro.niveau(tampon, n)
            EtatJarvis.majNiveau(niveau)

            // 4) Vérification périodique : Android a-t-il rendu notre capture muette ?
            val maintenant = SystemClock.elapsedRealtime()
            if (maintenant - derniereVerification > 3_000) {
                derniereVerification = maintenant
                if (micro.estReduitAuSilence()) {
                    micro.liberer()
                    EtatJarvis.passerA(
                        Etat.ERREUR,
                        "Micro coupé par Android (réglages rapides ou démarrage en arrière-plan). Rouvrez Jarvis."
                    )
                    delay(5_000)
                    EtatJarvis.passerA(Etat.VEILLE)
                    continue
                }
            }

            // On ignore les trames qui contiennent le bip
            if (maintenant < ignorerJusqua) continue

            // 5) Distribution selon l'état
            when (etat) {
                Etat.VEILLE -> if (detecteur.analyser(tampon, n, reglages.sensibilite)) {
                    ignorerJusqua = commencerEcoute(detecteur, transcripteur)
                }
                Etat.ECOUTE -> {
                    val avancement = transcripteur.analyser(tampon, n, niveau)
                    EtatJarvis.majPartielle(transcripteur.partielle)
                    if (avancement == Transcripteur.Avancement.TERMINE) {
                        micro.arreter()
                        traiter(transcripteur.terminer())
                    }
                }
                else -> Unit
            }
        }
    }

    /** VEILLE -> ECOUTE : bip court puis enregistrement. Retourne l'instant jusqu'auquel ignorer le micro. */
    private fun commencerEcoute(detecteur: DetecteurMotReveil, transcripteur: Transcripteur): Long {
        if (!EtatJarvis.passerA(Etat.ECOUTE)) return 0L
        detecteur.reinitialiser()
        transcripteur.commencer()
        try {
            bip?.startTone(ToneGenerator.TONE_PROP_BEEP, 150)
        } catch (_: RuntimeException) {
        }
        return SystemClock.elapsedRealtime() + 250
    }

    /** ECOUTE -> REFLEXION -> PAROLE -> VEILLE. Le micro reste coupé pendant ce temps. */
    private fun traiter(texte: String) {
        if (texte.isNotBlank()) EtatJarvis.majTranscription(texte)
        EtatJarvis.passerA(Etat.REFLEXION)
        tacheReponse = portee.launch {
            try {
                // Même sans rien comprendre, Jarvis répond : l'utilisateur sait que l'écoute est finie
                val reponse = if (texte.isBlank()) "Je n'ai rien entendu."
                else withContext(Dispatchers.IO) { executeur.executer(texte) }
                EtatJarvis.majReponse(reponse)
                if (EtatJarvis.passerA(Etat.PAROLE)) synthese.parler(reponse)
            } finally {
                val etat = EtatJarvis.etat
                if (etat == Etat.PAROLE || etat == Etat.REFLEXION) EtatJarvis.passerA(Etat.VEILLE)
            }
        }
    }

    /** Phrase de test (bouton des réglages). Évite de dire « Jarvis » pour ne pas se réveiller soi-même. */
    private fun testerVoix() {
        if (tacheReponse?.isActive == true) return
        tacheReponse = portee.launch {
            val depuisVeille = EtatJarvis.etat == Etat.VEILLE && EtatJarvis.passerA(Etat.PAROLE)
            try {
                synthese.parler("Bonjour, ma voix fonctionne correctement.")
            } finally {
                if (depuisVeille && EtatJarvis.etat == Etat.PAROLE) EtatJarvis.passerA(Etat.VEILLE)
            }
        }
    }

    private fun basculerPause() {
        enPause = !enPause
        EtatJarvis.majPause(enPause)
    }

    private fun quitter() {
        EtatJarvis.majServiceActif(false)
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        premierPlan = false
        stopSelf()
    }

    override fun onDestroy() {
        portee.cancel() // annule aussi la boucle audio, qui libère le micro dans son « finally »
        synthese.liberer()
        bip?.release()
        executeurAudio.shutdown()
        EtatJarvis.majServiceActif(false)
        super.onDestroy()
    }

    companion object {
        private const val TAG = "JarvisService"
        const val ACTION_DEMARRER = "fr.jarvis.assistant.DEMARRER"
        const val ACTION_ECOUTER = "fr.jarvis.assistant.ECOUTER"
        const val ACTION_PAUSE = "fr.jarvis.assistant.PAUSE"
        const val ACTION_QUITTER = "fr.jarvis.assistant.QUITTER"
        const val ACTION_RECHARGER = "fr.jarvis.assistant.RECHARGER"
        const val ACTION_TESTER_VOIX = "fr.jarvis.assistant.TESTER_VOIX"

        /** Démarre le service (à appeler depuis une activité visible). */
        fun demarrer(ctx: Context) = demarrerPremierPlan(ctx, ACTION_DEMARRER)

        /** Démarre le service si besoin et lance immédiatement une écoute (équivalent de F9). */
        fun ecouter(ctx: Context) = demarrerPremierPlan(ctx, ACTION_ECOUTER)

        /** Envoie une action à un service déjà démarré. */
        fun envoyer(ctx: Context, action: String) {
            if (!EtatJarvis.infos.value.serviceActif) return
            try {
                ctx.startService(Intent(ctx, JarvisService::class.java).setAction(action))
            } catch (e: IllegalStateException) {
                Log.w(TAG, "Action $action refusée", e)
            }
        }

        private fun demarrerPremierPlan(ctx: Context, action: String) {
            try {
                ContextCompat.startForegroundService(ctx, Intent(ctx, JarvisService::class.java).setAction(action))
            } catch (e: Exception) {
                Log.w(TAG, "Démarrage du service refusé", e)
            }
        }
    }
}
