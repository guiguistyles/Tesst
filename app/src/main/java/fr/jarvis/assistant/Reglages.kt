package fr.jarvis.assistant

import android.content.Context

/**
 * Réglages persistants de l'application (SharedPreferences).
 * Les lectures sont instantanées (valeurs en mémoire), on peut donc les
 * relire à chaque trame audio sans coût notable.
 */
class Reglages(context: Context) {

    private val prefs = context.applicationContext
        .getSharedPreferences("jarvis_reglages", Context.MODE_PRIVATE)

    /** Écoute continue du mot de réveil « Jarvis ». Si désactivé : bouton « Parler » uniquement. */
    var motReveilActif: Boolean
        get() = prefs.getBoolean(CLE_MOT_REVEIL, true)
        set(valeur) = prefs.edit().putBoolean(CLE_MOT_REVEIL, valeur).apply()

    /** Sensibilité du mot de réveil entre 0 (strict) et 1 (très sensible). */
    var sensibilite: Float
        get() = prefs.getFloat(CLE_SENSIBILITE, 0.5f)
        set(valeur) = prefs.edit().putFloat(CLE_SENSIBILITE, valeur.coerceIn(0f, 1f)).apply()

    /** Identifiant du modèle Vosk utilisé (voir CatalogueModeles). */
    var modeleId: String
        get() = prefs.getString(CLE_MODELE, MODELE_PAR_DEFAUT) ?: MODELE_PAR_DEFAUT
        set(valeur) = prefs.edit().putString(CLE_MODELE, valeur).apply()

    /** Proposer le démarrage de Jarvis au démarrage du téléphone. */
    var demarrageBoot: Boolean
        get() = prefs.getBoolean(CLE_BOOT, false)
        set(valeur) = prefs.edit().putBoolean(CLE_BOOT, valeur).apply()

    companion object {
        const val MODELE_PAR_DEFAUT = "vosk-model-small-fr-0.22"
        private const val CLE_MOT_REVEIL = "mot_reveil_actif"
        private const val CLE_SENSIBILITE = "sensibilite"
        private const val CLE_MODELE = "modele"
        private const val CLE_BOOT = "demarrage_boot"
    }
}
