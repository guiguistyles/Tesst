package fr.jarvis.assistant.commandes

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Tests du parseur de commandes (s'exécutent sur le PC, sans téléphone) :
 * Android Studio > clic droit sur ce fichier > Run, ou « gradlew test ».
 * Les phrases imitent la sortie de Vosk : minuscules, nombres en toutes lettres.
 */
class ParseurTest {

    /** Retourne (nom de la commande, premier groupe capturé) ou null si aucune commande. */
    private fun route(t: String): Pair<String, String>? {
        val p = Commandes.preparer(t)
        for (c in Commandes.liste) for (m in c.motifs) {
            val r = m.find(p.simple) ?: continue
            return c.nom to (if (r.groups.size > 1) p.groupe(r, 1) else "")
        }
        return null
    }

    @Test fun nombres() {
        assertEquals(97, TexteFr.nombre(TexteFr.mots("quatre-vingt-dix-sept")))
        assertEquals(21, TexteFr.nombre(TexteFr.mots("vingt et un")))
        assertEquals(77, TexteFr.nombre(TexteFr.mots("soixante dix sept")))
        assertEquals(80, TexteFr.nombre(TexteFr.mots("quatre vingts")))
        assertEquals(250, TexteFr.nombre(TexteFr.mots("deux cent cinquante")))
        assertEquals(12, TexteFr.nombre(TexteFr.mots("12")))
    }

    @Test fun durees() {
        assertEquals(300, TexteFr.duree("de cinq minutes"))
        assertEquals(150, TexteFr.duree("de deux minutes trente"))
        assertEquals(5400, TexteFr.duree("d'une heure et demie"))
        assertEquals(900, TexteFr.duree("d'un quart d'heure"))
        assertEquals(30, TexteFr.duree("de trente secondes"))
        assertEquals(300, TexteFr.duree("de 5"))
        assertEquals(1500, TexteFr.duree("de vingt cinq minutes"))
        assertEquals(null as Any?, TexteFr.duree("de"))
    }

    @Test fun heures() {
        assertEquals(7 to 30, TexteFr.heure("à sept heures trente"))
        assertEquals(6 to 45, TexteFr.heure("à 6h45"))
        assertEquals(7 to 45, TexteFr.heure("à huit heures moins le quart"))
        assertEquals(18 to 30, TexteFr.heure("à six heures et demie du soir"))
        assertEquals(12 to 0, TexteFr.heure("à midi"))
        assertEquals(0 to 15, TexteFr.heure("à minuit et quart"))
        assertEquals(7 to 0, TexteFr.heure("à 7"))
        assertEquals(21 to 5, TexteFr.heure("à vingt et une heures cinq"))
        assertEquals(7 to 50, TexteFr.heure("à huit heures moins dix"))
    }

    @Test fun routage() {
        assertEquals("Recherche Google" to "la météo à lyon", route("jarvis recherche la météo à lyon"))
        assertEquals("Recherche Google" to "recette de crêpes", route("cherche recette de crêpes"))
        assertEquals("Recherche Google" to "qui est marie curie", route("qui est marie curie"))
        assertEquals("Ouvrir une application" to "youtube", route("ouvre youtube"))
        assertEquals("Ouvrir une application" to "appareil photo", route("lance l'appareil photo"))
        assertEquals("Appel" to "maman", route("appelle maman"))
        assertEquals("Minuteur", route("mets un minuteur de cinq minutes")?.first)
        assertEquals("Réveil", route("réveille-moi à sept heures trente")?.first)
        assertEquals("Réveil", route("réveille moi à sept heures")?.first)
        assertEquals("Heure", route("quelle heure est-il")?.first)
        assertEquals("Heure", route("il est quelle heure")?.first)
        assertEquals("Date", route("quel jour sommes-nous")?.first)
        assertEquals("Lampe torche", route("lampe torche on")?.first)
        assertEquals("Lampe torche", route("allume la lampe s'il te plaît")?.first)
        assertEquals("Lampe torche", route("éteins la torche")?.first)
        assertEquals("Aide", route("qu'est-ce que tu sais faire")?.first)
        assertEquals("Politesse", route("merci jarvis")?.first)
        assertEquals("Heure", route("dis moi quelle heure il est")?.first)
        assertEquals(null as Any?, route("le chat dort sur le canapé"))
    }

    @Test fun formats() {
        assertEquals("7 heures 5", Commandes.formaterHeure(7, 5))
        assertEquals("midi", Commandes.formaterHeure(12, 0))
        assertEquals("2 minutes 30 secondes", Commandes.formaterDuree(150))
    }
}
