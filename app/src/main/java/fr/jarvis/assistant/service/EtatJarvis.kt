package fr.jarvis.assistant.service

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * États de la machine à états de Jarvis.
 * [libelle] est le texte affiché sous le cercle.
 */
enum class Etat(val libelle: String) {
    CHARGEMENT("Chargement…"),
    VEILLE("En veille — dites « Jarvis »"),
    ECOUTE("J'écoute…"),
    REFLEXION("Réflexion…"),
    PAROLE("Je réponds…"),
    ERREUR("Erreur");

    /** Indique si la transition de cet état vers [cible] est autorisée. */
    fun peutAller(cible: Etat): Boolean = cible in TRANSITIONS.getValue(this)

    companion object {
        /**
         * Table des transitions autorisées. CHARGEMENT et ERREUR sont
         * atteignables depuis n'importe quel état (rechargement du modèle, panne micro…).
         */
        private val TRANSITIONS: Map<Etat, Set<Etat>> = mapOf(
            CHARGEMENT to setOf(VEILLE, ERREUR, CHARGEMENT),
            VEILLE to setOf(ECOUTE, PAROLE, CHARGEMENT, ERREUR),
            ECOUTE to setOf(REFLEXION, VEILLE, CHARGEMENT, ERREUR),
            REFLEXION to setOf(PAROLE, VEILLE, CHARGEMENT, ERREUR),
            PAROLE to setOf(VEILLE, ECOUTE, CHARGEMENT, ERREUR),
            ERREUR to setOf(CHARGEMENT, VEILLE, ERREUR),
        )
    }
}

/** Instantané complet de ce que l'interface doit afficher. */
data class InfosAssistant(
    val etat: Etat = Etat.CHARGEMENT,
    /** Niveau sonore du micro, de 0 à 1 (échelle logarithmique). */
    val niveauMicro: Float = 0f,
    /** Transcription partielle pendant l'écoute. */
    val partielle: String = "",
    /** Dernière phrase reconnue. */
    val derniereTranscription: String = "",
    /** Dernière réponse prononcée. */
    val derniereReponse: String = "",
    /** Message d'erreur associé à l'état ERREUR. */
    val messageErreur: String = "",
    /** L'écoute est en pause (micro libéré) à la demande de l'utilisateur. */
    val enPause: Boolean = false,
    /** Le service au premier plan tourne. */
    val serviceActif: Boolean = false,
    /** Diagnostic de la synthèse vocale (moteur, voix, volume), affiché dans les réglages. */
    val etatVoix: String = "Synthèse vocale non initialisée",
    /** La synthèse vocale est utilisable. */
    val voixOk: Boolean = false,
    /** Voix françaises installées sur le téléphone (nom technique du moteur TTS). */
    val voixDisponibles: List<String> = emptyList(),
)

/**
 * Source unique de vérité, partagée entre le service et l'interface
 * (ils tournent dans le même processus). Toute modification passe par ici.
 */
object EtatJarvis {

    private const val TAG = "EtatJarvis"

    private val _infos = MutableStateFlow(InfosAssistant())
    val infos: StateFlow<InfosAssistant> = _infos.asStateFlow()

    /** État courant (raccourci). */
    val etat: Etat get() = _infos.value.etat

    /** Vrai quand une activité de l'appli est au premier plan (lancement d'activités autorisé). */
    @Volatile
    var ihmVisible: Boolean = false

    /**
     * Demande une transition. Retourne false (et journalise) si elle est interdite :
     * cela évite par exemple de repasser en ECOUTE pendant une REFLEXION.
     */
    @Synchronized
    fun passerA(cible: Etat, messageErreur: String = ""): Boolean {
        val actuel = _infos.value.etat
        if (actuel == cible && cible != Etat.ERREUR) return true
        if (!actuel.peutAller(cible)) {
            Log.w(TAG, "Transition refusée : $actuel -> $cible")
            return false
        }
        Log.d(TAG, "Transition : $actuel -> $cible")
        _infos.update {
            it.copy(
                etat = cible,
                messageErreur = if (cible == Etat.ERREUR) messageErreur else "",
                partielle = if (cible == Etat.ECOUTE) "" else it.partielle,
                niveauMicro = if (cible == Etat.ECOUTE || cible == Etat.VEILLE) it.niveauMicro else 0f,
            )
        }
        return true
    }

    fun majNiveau(niveau: Float) = _infos.update { it.copy(niveauMicro = niveau) }
    fun majPartielle(texte: String) = _infos.update { it.copy(partielle = texte) }
    fun majTranscription(texte: String) = _infos.update { it.copy(derniereTranscription = texte, partielle = "") }
    fun majReponse(texte: String) = _infos.update { it.copy(derniereReponse = texte) }
    fun majVoix(message: String, ok: Boolean) = _infos.update { it.copy(etatVoix = message, voixOk = ok) }
    fun majVoixDisponibles(noms: List<String>) = _infos.update { it.copy(voixDisponibles = noms) }
    fun majPause(pause: Boolean) = _infos.update { it.copy(enPause = pause, niveauMicro = 0f) }
    fun majServiceActif(actif: Boolean) = _infos.update {
        if (actif) it.copy(serviceActif = true)
        else InfosAssistant(
            derniereTranscription = it.derniereTranscription,
            derniereReponse = it.derniereReponse,
            etatVoix = it.etatVoix,
            voixOk = it.voixOk,
            voixDisponibles = it.voixDisponibles,
        )
    }
}
