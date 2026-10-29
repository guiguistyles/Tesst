package fr.jarvis.assistant.commandes

import java.text.Normalizer

/**
 * Outils de traitement du texte français reconnu par Vosk :
 * normalisation, comparaison approximative et conversion des nombres écrits en lettres.
 * (Vosk renvoie « sept heures trente », pas « 7h30 ».)
 */
object TexteFr {

    /** Retire les accents caractère par caractère : la longueur de la chaîne est conservée. */
    fun sansAccents(texte: String): String = buildString(texte.length) {
        for (c in texte) {
            val decompose = Normalizer.normalize(c.toString(), Normalizer.Form.NFD)
            append(decompose.firstOrNull { Character.getType(it) != Character.NON_SPACING_MARK.toInt() } ?: c)
        }
    }

    /** Forme de comparaison : minuscules, sans accents, sans ponctuation. */
    fun cle(texte: String): String =
        sansAccents(texte.lowercase())
            .replace(Regex("[^a-z0-9 ]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

    /** Similarité entre 0 et 1 (distance de Levenshtein normalisée, bonus d'inclusion). */
    fun similarite(a: String, b: String): Float {
        val x = cle(a)
        val y = cle(b)
        if (x.isEmpty() || y.isEmpty()) return 0f
        if (x == y) return 1f
        if (y.startsWith(x) || x.startsWith(y)) return 0.9f
        if (y.contains(x) || x.contains(y)) return 0.8f
        val distance = levenshtein(x, y)
        return 1f - distance.toFloat() / maxOf(x.length, y.length)
    }

    private fun levenshtein(a: String, b: String): Int {
        var precedent = IntArray(b.length + 1) { it }
        var courant = IntArray(b.length + 1)
        for (i in 1..a.length) {
            courant[0] = i
            for (j in 1..b.length) {
                val cout = if (a[i - 1] == b[j - 1]) 0 else 1
                courant[j] = minOf(courant[j - 1] + 1, precedent[j] + 1, precedent[j - 1] + cout)
            }
            val t = precedent
            precedent = courant
            courant = t
        }
        return precedent[b.length]
    }

    // ---------------------------------------------------------------- Nombres

    private val UNITES = mapOf(
        "zero" to 0, "un" to 1, "une" to 1, "deux" to 2, "trois" to 3, "quatre" to 4,
        "cinq" to 5, "six" to 6, "sept" to 7, "huit" to 8, "neuf" to 9, "dix" to 10,
        "onze" to 11, "douze" to 12, "treize" to 13, "quatorze" to 14, "quinze" to 15,
        "seize" to 16, "vingt" to 20, "vingts" to 20, "trente" to 30, "quarante" to 40,
        "cinquante" to 50, "soixante" to 60, "cent" to 100, "cents" to 100,
        "mille" to 1000,
    )

    /** Vrai si le mot fait partie d'un nombre (« vingt », « et » dans « vingt et un », « 12 »…). */
    fun estMotNombre(mot: String) = mot in UNITES || mot.all { it.isDigit() } && mot.isNotEmpty()

    /**
     * Convertit une suite de mots en nombre : « quatre vingt dix sept » -> 97,
     * « vingt et un » -> 21, « 12 » -> 12. Retourne null si aucun nombre.
     */
    fun nombre(mots: List<String>): Int? {
        var total = 0
        var courant = 0
        var trouve = false
        for (mot in mots) {
            when {
                mot == "et" -> continue
                mot.isNotEmpty() && mot.all { it.isDigit() } -> {
                    courant += mot.toInt(); trouve = true
                }
                mot in UNITES -> {
                    val v = UNITES.getValue(mot)
                    trouve = true
                    when {
                        v == 1000 -> { total += maxOf(courant, 1) * 1000; courant = 0 }
                        v == 100 -> courant = maxOf(courant, 1) * 100
                        // « quatre vingt » = 4 × 20
                        v == 20 && courant % 100 == 4 -> courant += 76
                        else -> courant += v
                    }
                }
                else -> return if (trouve) total + courant else null
            }
        }
        return if (trouve) total + courant else null
    }

    /** Découpe en mots en séparant les chiffres collés aux lettres (« 7h30 » -> 7 h 30). */
    fun mots(texte: String): List<String> =
        cle(texte)
            .replace(Regex("(\\d)([a-z])"), "$1 $2")
            .replace(Regex("([a-z])(\\d)"), "$1 $2")
            .split(' ')
            .filter { it.isNotBlank() }

    /**
     * Durée en secondes : « cinq minutes », « deux minutes trente », « une heure et demie »,
     * « un quart d'heure », « 30 secondes ». Retourne null si incompréhensible.
     */
    fun duree(texte: String): Int? {
        val mots = mots(texte.replace(":", " h "))
        val unites = mapOf(
            "heure" to 3600, "heures" to 3600, "h" to 3600,
            "minute" to 60, "minutes" to 60, "min" to 60, "mn" to 60,
            "seconde" to 1, "secondes" to 1, "s" to 1, "sec" to 1,
        )
        val joint = mots.joinToString(" ")
        if (Regex("\\bquart d heure\\b").containsMatchIn(joint)) return 15 * 60
        if (Regex("\\bdemi(e)? heure\\b").containsMatchIn(joint)) return 30 * 60

        var total = 0
        var tampon = mutableListOf<String>()
        var derniereUnite = 0
        var i = 0
        while (i < mots.size) {
            val mot = mots[i]
            when {
                mot in unites -> {
                    val n = nombre(tampon) ?: 1
                    derniereUnite = unites.getValue(mot)
                    total += n * derniereUnite
                    tampon = mutableListOf()
                    // « et demie » après l'unité
                    if (i + 2 < mots.size && mots[i + 1] == "et" && mots[i + 2].startsWith("demi")) {
                        total += derniereUnite / 2
                        i += 2
                    }
                }
                estMotNombre(mot) || mot == "et" -> tampon.add(mot)
                // Un autre mot interrompt le nombre en cours
                else -> tampon = mutableListOf()
            }
            i++
        }
        // Nombre restant sans unité : « deux minutes trente » -> 30 s ; « minuteur de 5 » -> 5 min
        nombre(tampon)?.let { reste ->
            total += when (derniereUnite) {
                3600 -> reste * 60
                60 -> reste
                0 -> reste * 60
                else -> reste
            }
        }
        return total.takeIf { it > 0 }
    }

    /**
     * Heure de la journée : « sept heures trente », « 7h30 », « 7:30 », « midi », « minuit »,
     * « huit heures moins le quart », « six heures et demie du soir ». Retourne (heure, minute).
     */
    fun heure(texte: String): Pair<Int, Int>? {
        val mots = mots(texte.replace(":", " h "))
        if (mots.isEmpty()) return null
        val joint = mots.joinToString(" ")
        var heures: Int
        var reste: List<String>
        val indexMidi = mots.indexOfFirst { it == "midi" || it == "minuit" }
        val indexHeure = mots.indexOfFirst { it == "heure" || it == "heures" || it == "h" }
        when {
            indexMidi >= 0 -> {
                heures = if (mots[indexMidi] == "midi") 12 else 0
                reste = mots.drop(indexMidi + 1)
            }
            indexHeure >= 0 -> {
                // On prend les mots-nombres juste avant « heure(s) »
                val avant = mots.subList(0, indexHeure).takeLastWhile { estMotNombre(it) || it == "et" }
                heures = nombre(avant) ?: return null
                reste = mots.drop(indexHeure + 1)
            }
            else -> {
                // « réveille-moi à 7 » : un nombre seul = heure pile
                val premier = mots.indexOfFirst { estMotNombre(it) }
                if (premier < 0) return null
                heures = nombre(mots.drop(premier).takeWhile { estMotNombre(it) || it == "et" }) ?: return null
                reste = emptyList()
            }
        }
        val suite = reste.joinToString(" ")
        var minutes = when {
            suite.startsWith("et quart") -> 15
            suite.startsWith("et demi") -> 30
            suite.startsWith("moins le quart") || suite.startsWith("moins quart") -> -15
            suite.startsWith("moins") -> -(nombre(reste.drop(1).takeWhile { estMotNombre(it) || it == "et" }) ?: 0)
            else -> nombre(reste.takeWhile { estMotNombre(it) || it == "et" }) ?: 0
        }
        if (minutes < 0) {
            heures -= 1
            minutes += 60
        }
        // Précision « du soir » / « de l'après-midi »
        if ((joint.contains("du soir") || joint.contains("apres midi")) && heures in 1..11) heures += 12
        heures = ((heures % 24) + 24) % 24
        if (minutes !in 0..59) return null
        return heures to minutes
    }
}
