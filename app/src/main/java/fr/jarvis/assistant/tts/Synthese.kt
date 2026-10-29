package fr.jarvis.assistant.tts

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import android.util.Log
import fr.jarvis.assistant.Reglages
import fr.jarvis.assistant.service.EtatJarvis
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume

/**
 * Synthèse vocale avec le moteur TextToSpeech natif d'Android, voix fr-FR.
 * [parler] est une fonction suspendue qui ne rend la main qu'une fois la phrase
 * entièrement prononcée : le service peut ainsi rester dans l'état PAROLE
 * pendant exactement la durée de la réponse.
 *
 * Chaque problème rencontré (moteur absent, voix non téléchargée, volume à zéro,
 * erreur de lecture) est publié dans EtatJarvis.etatVoix et affiché dans les réglages.
 */
class Synthese(context: Context) : TextToSpeech.OnInitListener {

    private val appContext = context.applicationContext
    private val reglages = Reglages(appContext)
    private val audio = appContext.getSystemService(AudioManager::class.java)
    private val pret = CompletableDeferred<Boolean>()
    private val enAttente = ConcurrentHashMap<String, CancellableContinuation<Unit>>()
    private val tts = TextToSpeech(appContext, this)

    override fun onInit(statut: Int) {
        if (statut != TextToSpeech.SUCCESS) {
            signaler("Aucun moteur de synthèse vocale : installez « Speech Services by Google » depuis le Play Store.", false)
            pret.complete(false)
            return
        }
        val langue = tts.setLanguage(Locale.FRANCE)
        if (langue == TextToSpeech.LANG_NOT_SUPPORTED) {
            signaler("Le moteur de synthèse ne gère pas le français : changez de moteur dans les réglages de synthèse vocale.", false)
            pret.complete(false)
            return
        }
        if (langue == TextToSpeech.LANG_MISSING_DATA) {
            signaler("Voix française non téléchargée : réglages de synthèse vocale > Installer les données vocales > Français.", false)
            pret.complete(false)
            return
        }
        appliquerReglages()
        // Flux « média » : c'est le volume que l'on règle avec les boutons du téléphone
        tts.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String) {}
            override fun onDone(id: String) = terminer(id)
            override fun onStop(id: String, interrompu: Boolean) = terminer(id)
            @Deprecated("Remplacée par onError(String, Int) mais encore appelée sur certains appareils")
            override fun onError(id: String) = erreur(id, TextToSpeech.ERROR)
            override fun onError(id: String, codeErreur: Int) = erreur(id, codeErreur)
        })
        signaler("Voix prête : ${tts.voice?.name ?: "voix française par défaut"}", true)
        pret.complete(true)
    }

    /** Voix françaises réellement installées (une voix « non installée » ne produit aucun son). */
    private fun voixFrancaises(): List<Voice> =
        tts.voices
            ?.filter { it.locale.language == "fr" && estInstallee(it) && !it.isNetworkConnectionRequired }
            ?.sortedBy { it.name }
            ?: emptyList()

    /**
     * Applique les réglages de voix : voix choisie par l'utilisateur, sinon une voix
     * masculine française (style Jarvis), sinon la meilleure voix française installée.
     * Puis la hauteur et le débit. Appelé à chaque phrase : les changements sont immédiats.
     */
    private fun appliquerReglages() {
        try {
            val voix = voixFrancaises()
            EtatJarvis.majVoixDisponibles(voix.map { it.name })
            val actuelle = tts.voice?.takeIf { it.locale.language == "fr" && estInstallee(it) }
            val choisie = voix.firstOrNull { it.name == reglages.voixNom }
                ?: voix.firstOrNull { estMasculine(it.name) && it.locale.country == "FR" }
                ?: voix.firstOrNull { estMasculine(it.name) }
                ?: actuelle
                ?: voix.sortedWith(compareByDescending<Voice> { it.locale.country == "FR" }.thenByDescending { it.quality })
                    .firstOrNull()
            if (choisie != null && choisie != tts.voice) tts.voice = choisie
        } catch (e: Exception) {
            Log.w(TAG, "Sélection de voix impossible, voix par défaut conservée", e)
        }
        tts.setPitch(reglages.hauteurVoix)
        tts.setSpeechRate(reglages.debitVoix)
    }

    private fun estInstallee(voix: Voice) =
        voix.features?.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED) != true

    private fun erreur(id: String, code: Int) {
        signaler("Erreur de lecture de la voix (code $code). Essayez un autre moteur ou réinstallez la voix française.", false)
        terminer(id)
    }

    private fun terminer(id: String) {
        enAttente.remove(id)?.let { if (it.isActive) it.resume(Unit) }
    }

    private fun signaler(message: String, ok: Boolean) {
        Log.i(TAG, message)
        EtatJarvis.majVoix(message, ok)
    }

    /** Prononce [texte] et attend la fin (au plus 30 s). */
    suspend fun parler(texte: String) {
        if (texte.isBlank()) return
        val disponible = withTimeoutOrNull(8_000) { pret.await() }
        if (disponible == null) {
            signaler("Le moteur de synthèse vocale ne répond pas.", false)
            return
        }
        if (!disponible) return
        if (audio.getStreamVolume(AudioManager.STREAM_MUSIC) == 0) {
            signaler("Volume média à zéro : montez le volume pour entendre Jarvis.", false)
        } else if (!EtatJarvis.infos.value.voixOk) {
            signaler("Voix prête : ${tts.voice?.name ?: "voix française par défaut"}", true)
        }
        appliquerReglages()
        withTimeoutOrNull(30_000) {
            suspendCancellableCoroutine { suite ->
                val id = UUID.randomUUID().toString()
                enAttente[id] = suite
                suite.invokeOnCancellation {
                    enAttente.remove(id)
                    tts.stop()
                }
                if (tts.speak(texte, TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.ERROR) {
                    erreur(id, TextToSpeech.ERROR)
                }
            }
        }
    }

    /** Interrompt la phrase en cours (par exemple si l'utilisateur relance l'écoute). */
    fun interrompre() {
        tts.stop()
        enAttente.keys.toList().forEach { terminer(it) }
    }

    fun liberer() {
        interrompre()
        tts.shutdown()
    }

    companion object {
        private const val TAG = "Synthese"

        /**
         * Le moteur TTS n'indique pas le genre d'une voix : on s'appuie sur les noms connus.
         * Google : fr-fr-x-frb et fr-fr-x-frd sont masculines. Samsung : « SMTm.. » = masculine.
         */
        private val INDICES_MASCULINS = listOf("frb", "frd", "smtm", "male", "homme")

        fun estMasculine(nomVoix: String): Boolean {
            val nom = nomVoix.lowercase(Locale.ROOT)
            return INDICES_MASCULINS.any { nom.contains(it) } && !nom.contains("female")
        }

        /** Libellé affiché dans les réglages. */
        fun libelleVoix(nomVoix: String): String =
            nomVoix + if (estMasculine(nomVoix)) " — masculine" else ""
    }
}
