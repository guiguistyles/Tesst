package fr.jarvis.assistant.stt

import android.os.SystemClock
import org.json.JSONObject
import org.vosk.Model
import org.vosk.Recognizer

/**
 * Transcription d'une commande vocale en français avec Vosk (vocabulaire complet),
 * plus une détection de fin de parole (VAD) basée sur l'énergie :
 * - le bruit de fond est estimé en continu ;
 * - une trame est « parole » si elle dépasse le bruit de fond de ~7 dB ;
 * - l'enregistrement s'arrête après [SILENCE_FIN_MS] de silence suivant de la parole,
 *   ou si rien n'est dit pendant [DELAI_SANS_PAROLE_MS], ou au bout de [DUREE_MAX_MS].
 */
class Transcripteur(modele: Model) : AutoCloseable {

    enum class Avancement { EN_COURS, TERMINE }

    private val reconnaisseur = Recognizer(modele, 16_000f)
    private val morceaux = StringBuilder()
    private var debut = 0L
    private var dernierSon = 0L
    private var paroleDetectee = false
    private var bruitFond = 0.3f
    private var dernierePartielle = ""

    /** Dernier résultat partiel (affiché en direct dans l'interface). */
    val partielle: String get() = (morceaux.toString() + dernierePartielle).trim()

    /** Prépare une nouvelle écoute. */
    fun commencer() {
        reconnaisseur.reset()
        morceaux.clear()
        dernierePartielle = ""
        debut = SystemClock.elapsedRealtime()
        dernierSon = debut
        paroleDetectee = false
    }

    /** Fournit une trame audio et indique si l'écoute est terminée. */
    fun analyser(tampon: ShortArray, n: Int, niveau: Float): Avancement {
        val maintenant = SystemClock.elapsedRealtime()

        // Estimation du bruit de fond : descend vite, remonte lentement
        bruitFond = if (niveau < bruitFond) 0.5f * bruitFond + 0.5f * niveau
        else 0.995f * bruitFond + 0.005f * niveau

        if (niveau > bruitFond + ECART_PAROLE) {
            paroleDetectee = true
            dernierSon = maintenant
        }

        if (reconnaisseur.acceptWaveForm(tampon, n)) {
            // Vosk a détecté une fin d'énoncé : on garde le morceau et on continue
            val texte = JSONObject(reconnaisseur.result).optString("text")
            if (texte.isNotBlank()) morceaux.append(texte).append(' ')
            dernierePartielle = ""
        } else {
            val partiel = JSONObject(reconnaisseur.partialResult).optString("partial")
            if (partiel != dernierePartielle) {
                // Le texte évolue : l'utilisateur parle encore
                if (partiel.length > dernierePartielle.length) {
                    paroleDetectee = true
                    dernierSon = maintenant
                }
                dernierePartielle = partiel
            }
        }

        return when {
            paroleDetectee && maintenant - dernierSon > SILENCE_FIN_MS -> Avancement.TERMINE
            !paroleDetectee && maintenant - debut > DELAI_SANS_PAROLE_MS -> Avancement.TERMINE
            maintenant - debut > DUREE_MAX_MS -> Avancement.TERMINE
            else -> Avancement.EN_COURS
        }
    }

    /** Termine l'écoute et retourne le texte complet reconnu (peut être vide). */
    fun terminer(): String {
        val fin = JSONObject(reconnaisseur.finalResult).optString("text")
        morceaux.append(fin)
        return morceaux.toString().replace(Regex("\\s+"), " ").trim()
    }

    override fun close() = reconnaisseur.close()

    companion object {
        /** Écart minimal au bruit de fond (0,12 ≈ 7 dB sur l'échelle 0-1 de 60 dB). */
        private const val ECART_PAROLE = 0.12f
        const val SILENCE_FIN_MS = 1_200L
        const val DELAI_SANS_PAROLE_MS = 5_000L
        const val DUREE_MAX_MS = 12_000L
    }
}
