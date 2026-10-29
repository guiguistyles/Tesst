package fr.jarvis.assistant.wake

import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer

/**
 * Détection du mot de réveil « Jarvis » avec Vosk en mode « grammaire restreinte » :
 * le reconnaisseur ne peut produire que les variantes ci-dessous ou « [unk] »
 * (mot inconnu). C'est très léger en CPU et totalement hors ligne.
 *
 * « Jarvis » n'étant pas un mot français, il peut manquer au lexique du modèle :
 * on ajoute donc des découpages phonétiques (« jar vis », « jarre vice »…).
 * Vosk ignore silencieusement (avertissement logcat) les variantes dont un mot
 * est absent du vocabulaire, les autres restent actives.
 */
class DetecteurMotReveil(modele: Model) : AutoCloseable {

    private val reconnaisseur = Recognizer(modele, FREQUENCE, grammaire()).apply {
        setWords(true) // pour obtenir un score de confiance par mot
    }

    /**
     * Analyse une trame. Retourne true si le mot de réveil vient d'être détecté.
     * @param sensibilite 0 = strict (peu de faux positifs), 1 = très sensible.
     */
    fun analyser(tampon: ShortArray, n: Int, sensibilite: Float): Boolean {
        val finEnonce = reconnaisseur.acceptWaveForm(tampon, n)
        val detecte = if (finEnonce) {
            // Fin d'énoncé : on dispose des confiances par mot
            verifierResultat(reconnaisseur.result, seuilConfiance(sensibilite))
        } else if (sensibilite >= SEUIL_MODE_RAPIDE) {
            // Mode rapide : on déclenche dès le résultat partiel, sans attendre la pause
            contientVariante(JSONObject(reconnaisseur.partialResult).optString("partial"))
        } else {
            false
        }
        if (detecte) reinitialiser()
        return detecte
    }

    fun reinitialiser() = reconnaisseur.reset()

    override fun close() = reconnaisseur.close()

    private fun verifierResultat(json: String, seuil: Float): Boolean {
        val resultat = JSONObject(json)
        if (!contientVariante(resultat.optString("text"))) return false
        val mots = resultat.optJSONArray("result") ?: return true
        // Moyenne des confiances des mots qui ne sont pas « [unk] »
        var somme = 0.0
        var nombre = 0
        for (i in 0 until mots.length()) {
            val mot = mots.getJSONObject(i)
            if (mot.optString("word") == "[unk]") continue
            somme += mot.optDouble("conf", 1.0)
            nombre++
        }
        return nombre > 0 && somme / nombre >= seuil
    }

    private fun contientVariante(texte: String): Boolean {
        val propre = " " + texte.replace("[unk]", " ").trim().replace(Regex("\\s+"), " ") + " "
        return VARIANTES.any { propre.contains(" $it ") }
    }

    companion object {
        private const val FREQUENCE = 16_000f
        /** Au-delà de cette sensibilité, détection sur résultat partiel (plus réactif). */
        private const val SEUIL_MODE_RAPIDE = 0.7f

        /** Variantes acceptées pour « Jarvis ». Modifiez cette liste pour changer de mot de réveil. */
        val VARIANTES = listOf(
            "jarvis", "jar vis", "jar vice", "jars vis", "jars vice",
            "jarre vis", "jarre vice", "gare vis", "gare vice",
        )

        /** Sensibilité 0 -> confiance 0,9 exigée ; sensibilité 1 -> 0,4. */
        fun seuilConfiance(sensibilite: Float) = 0.9f - 0.5f * sensibilite.coerceIn(0f, 1f)

        private fun grammaire(): String =
            (VARIANTES + "[unk]").joinToString(prefix = "[", postfix = "]") { "\"$it\"" }
    }
}
