package fr.jarvis.assistant.commandes

import android.content.Context
import android.util.Log
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/*
 * ============================================================================
 *  COMMANDES VOCALES
 * ============================================================================
 *  Pour ajouter une commande : ajoutez un élément à la liste [Commandes.liste].
 *  - les expressions régulières sont testées sur le texte en minuscules,
 *    SANS ACCENTS, tirets remplacés par des espaces (« réveille-moi » -> « reveille moi ») ;
 *  - utilisez phrase.groupe(m, n) pour récupérer un groupe AVEC ses accents d'origine ;
 *  - la fonction retourne la phrase que Jarvis prononcera ;
 *  - les commandes sont testées dans l'ordre : mettez les plus spécifiques en premier.
 * ============================================================================
 */

/** Phrase reconnue, sous deux formes de même longueur : originale et simplifiée. */
class Phrase(val originale: String) {
    /** Version sans accents (même longueur que [originale], les index correspondent). */
    val simple: String = TexteFr.sansAccents(originale)

    /** Texte d'un groupe capturé, avec ses accents d'origine. */
    fun groupe(m: MatchResult, index: Int): String =
        m.groups[index]?.range?.let { originale.substring(it.first, it.last + 1) }?.trim().orEmpty()
}

/** Ce dont une commande dispose pour s'exécuter. */
class ContexteCommande(val actions: Actions, val phrase: Phrase)

/** Une commande : un nom, des exemples (affichés dans les réglages), des motifs et une action. */
class Commande(
    val nom: String,
    val exemples: List<String>,
    val motifs: List<Regex>,
    val action: suspend ContexteCommande.(MatchResult) -> String,
)

object Commandes {

    const val REPONSE_INCONNUE = "Je n'ai pas compris."

    val liste: List<Commande> = listOf(

        Commande(
            nom = "Minuteur",
            exemples = listOf("minuteur de cinq minutes", "mets un minuteur de deux minutes trente"),
            motifs = listOf(Regex("\\b(?:minuteur|minuterie|compte a rebours|timer)\\b(.*)$")),
        ) { m ->
            val secondes = TexteFr.duree(m.groupValues[1])
                ?: return@Commande "Pour combien de temps ? Dites par exemple : minuteur de cinq minutes."
            val duree = formaterDuree(secondes)
            when (actions.minuteur(secondes, "Minuteur $duree")) {
                Actions.Lancement.OUVERT -> "Minuteur de $duree lancé."
                Actions.Lancement.NOTIFICATION -> "Touchez la notification pour lancer le minuteur de $duree."
                Actions.Lancement.IMPOSSIBLE -> "Aucune application d'horloge ne gère les minuteurs."
            }
        },

        Commande(
            nom = "Réveil",
            exemples = listOf("réveille-moi à sept heures trente", "mets une alarme à 6h45"),
            motifs = listOf(Regex("\\b(?:reveille moi|reveil|alarme)\\b(.*)$")),
        ) { m ->
            val (h, min) = TexteFr.heure(m.groupValues[1])
                ?: return@Commande "À quelle heure ? Dites par exemple : réveille-moi à sept heures."
            val texteHeure = formaterHeure(h, min)
            when (actions.alarme(h, min)) {
                Actions.Lancement.OUVERT -> "Alarme réglée à $texteHeure."
                Actions.Lancement.NOTIFICATION -> "Touchez la notification pour régler l'alarme à $texteHeure."
                Actions.Lancement.IMPOSSIBLE -> "Aucune application d'horloge ne gère les alarmes."
            }
        },

        Commande(
            nom = "Heure",
            exemples = listOf("quelle heure est-il", "il est quelle heure"),
            motifs = listOf(Regex("\\b(?:quelle heure|l'heure)\\b")),
        ) {
            val maintenant = LocalTime.now()
            "Il est ${formaterHeure(maintenant.hour, maintenant.minute)}."
        },

        Commande(
            nom = "Date",
            exemples = listOf("quel jour sommes-nous", "quelle est la date"),
            motifs = listOf(Regex("\\b(?:quel jour|quelle date|la date|on est le combien|quel jour on est)\\b")),
        ) {
            val aujourdhui = LocalDate.now()
            val jour = if (aujourdhui.dayOfMonth == 1) "1er" else aujourdhui.dayOfMonth.toString()
            val semaine = aujourdhui.format(DateTimeFormatter.ofPattern("EEEE", Locale.FRENCH))
            val moisAnnee = aujourdhui.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRENCH))
            "Nous sommes le $semaine $jour $moisAnnee."
        },

        Commande(
            nom = "Lampe torche",
            exemples = listOf("lampe torche on", "allume la lampe", "éteins la torche"),
            motifs = listOf(Regex("\\b(?:lampe(?: torche)?|torche|flash)\\b")),
        ) {
            val texte = phrase.simple
            val demande: Boolean? = when {
                Regex("\\b(?:eteins|eteint|eteindre|desactive|coupe|off|stop)\\b").containsMatchIn(texte) -> false
                Regex("\\b(?:allume|allumer|active|on|ouvre)\\b").containsMatchIn(texte) -> true
                else -> null // inverser
            }
            if (!actions.aUneLampe()) return@Commande "Ce téléphone n'a pas de lampe torche."
            when (actions.lampe(demande)) {
                true -> "Lampe allumée."
                false -> "Lampe éteinte."
                null -> "Impossible de contrôler la lampe pour le moment."
            }
        },

        Commande(
            nom = "Aide",
            exemples = listOf("qu'est-ce que tu sais faire", "aide"),
            motifs = listOf(Regex("^(?:aide|qu'est ce que tu sais faire|que sais tu faire|tu sais faire quoi)\\b")),
        ) {
            "Je sais gérer : " + nomsCommandes() + "."
        },

        Commande(
            nom = "Appel",
            exemples = listOf("appelle Maman", "téléphone à Paul"),
            motifs = listOf(Regex("^(?:appelle|appeler|appel|telephone a|telephoner a|telephone)\\s+(.+)$")),
        ) { m ->
            val nom = phrase.groupe(m, 1)
            if (!actions.peutLireContacts()) {
                actions.appeler(null)
                return@Commande "Je n'ai pas accès à vos contacts, j'ouvre le téléphone."
            }
            val contact = actions.trouverContact(nom)
                ?: return@Commande "Je ne trouve pas $nom dans vos contacts."
            when (actions.appeler(contact.numero)) {
                Actions.Lancement.OUVERT -> "J'appelle ${contact.nom}."
                Actions.Lancement.NOTIFICATION -> "Touchez la notification pour appeler ${contact.nom}."
                Actions.Lancement.IMPOSSIBLE -> "Ce téléphone ne peut pas passer d'appel."
            }
        },

        Commande(
            nom = "Recherche Google",
            exemples = listOf("recherche la météo à Lyon", "cherche recette de crêpes", "qui est Marie Curie"),
            motifs = listOf(
                Regex("^(?:fais une |lance une )?(?:re)?cherche(?:r)?(?: sur (?:google|internet|le web))?\\s+(.+)$"),
                Regex("^((?:qui est|qui etait|c'est quoi|qu'est ce que|qu'est ce qu'|combien|ou se trouve|comment) .+)$"),
            ),
        ) { m ->
            val requete = phrase.groupe(m, 1)
            when (actions.rechercherGoogle(requete)) {
                Actions.Lancement.OUVERT -> "Je recherche $requete."
                Actions.Lancement.NOTIFICATION -> "Touchez la notification pour voir les résultats."
                Actions.Lancement.IMPOSSIBLE -> "Aucun navigateur n'est installé."
            }
        },

        Commande(
            nom = "Ouvrir une application",
            exemples = listOf("ouvre YouTube", "lance l'appareil photo"),
            motifs = listOf(Regex("^(?:ouvre|ouvrir|lance|lancer|demarre|demarrer)\\s+(?:l'application |l'appli |l'app |l'|le |la |les )?(.+)$")),
        ) { m ->
            val nom = phrase.groupe(m, 1)
            val appli = actions.trouverAppli(nom)
                ?: return@Commande "Je ne trouve pas l'application $nom."
            when (actions.ouvrirAppli(appli)) {
                Actions.Lancement.OUVERT -> "J'ouvre ${appli.nom}."
                Actions.Lancement.NOTIFICATION -> "Touchez la notification pour ouvrir ${appli.nom}."
                Actions.Lancement.IMPOSSIBLE -> "Impossible d'ouvrir ${appli.nom}."
            }
        },

        Commande(
            nom = "Politesse",
            exemples = listOf("bonjour", "merci"),
            motifs = listOf(Regex("^(?:merci|bonjour|salut|bonsoir|coucou|ca va)\\b")),
        ) {
            when {
                phrase.simple.startsWith("merci") -> "Avec plaisir."
                phrase.simple.startsWith("ca va") -> "Tous mes systèmes sont opérationnels."
                else -> "Bonjour. Que puis-je faire pour vous ?"
            }
        },
    )

    /** Liste lisible des commandes (une fonction, car la liste ne peut pas se citer elle-même à l'initialisation). */
    fun nomsCommandes(): String =
        liste.filter { it.nom != "Aide" && it.nom != "Politesse" }
            .joinToString(", ") { it.nom.lowercase(Locale.FRENCH) }

    // Formules à retirer au début : le mot de réveil s'il a été transcrit, et les politesses
    private val PREFIXES = Regex(
        "^(?:(?:jarvis|jar vis|jar vice|ok|dis moi|dis|hey|euh|alors|s'il te plait|s'il vous plait|" +
            "est ce que tu peux|est ce que tu pourrais|tu peux|peux tu|pourrais tu|tu pourrais|" +
            "je veux que tu|je voudrais que tu|j'aimerais que tu)\\s+)+"
    )
    private val SUFFIXES = Regex("(?:\\s+(?:s'il te plait|s'il vous plait|merci|jarvis))+$")

    /** Met la transcription brute sous une forme exploitable par les motifs. */
    fun preparer(brut: String): Phrase {
        var texte = brut.lowercase(Locale.FRENCH)
            .replace('’', '\'')
            .replace('-', ' ')
            .replace(Regex("[,.;!?]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
        // Les index de la version sans accents correspondent à ceux du texte original
        PREFIXES.find(TexteFr.sansAccents(texte))?.let { texte = texte.substring(it.range.last + 1) }
        SUFFIXES.find(TexteFr.sansAccents(texte))?.let { texte = texte.substring(0, it.range.first) }
        return Phrase(texte.trim())
    }

    /** « 7 heures 5 », « midi », « minuit 30 ». */
    fun formaterHeure(h: Int, min: Int): String {
        val base = when (h) {
            0 -> "minuit"
            12 -> "midi"
            1 -> "1 heure"
            else -> "$h heures"
        }
        return if (min == 0) base else "$base $min"
    }

    /** « 2 minutes 30 secondes », « 1 heure ». */
    fun formaterDuree(secondes: Int): String {
        val h = secondes / 3600
        val m = (secondes % 3600) / 60
        val s = secondes % 60
        return buildList {
            if (h > 0) add(if (h == 1) "1 heure" else "$h heures")
            if (m > 0) add(if (m == 1) "1 minute" else "$m minutes")
            if (s > 0) add(if (s == 1) "1 seconde" else "$s secondes")
        }.joinToString(" ")
    }
}

/** Trouve et exécute la commande correspondant à une phrase reconnue. */
class ExecuteurCommandes(context: Context) {

    private val actions = Actions(context)

    suspend fun executer(transcription: String): String {
        val phrase = Commandes.preparer(transcription)
        if (phrase.simple.isBlank()) return "Je n'ai rien entendu."
        for (commande in Commandes.liste) {
            for (motif in commande.motifs) {
                val correspondance = motif.find(phrase.simple) ?: continue
                Log.d(TAG, "« ${phrase.originale} » -> ${commande.nom}")
                return try {
                    commande.action(ContexteCommande(actions, phrase), correspondance)
                } catch (e: Exception) {
                    Log.e(TAG, "Erreur dans la commande ${commande.nom}", e)
                    "Désolé, la commande ${commande.nom.lowercase(Locale.FRENCH)} a échoué."
                }
            }
        }
        return Commandes.REPONSE_INCONNUE
    }

    companion object {
        private const val TAG = "Commandes"
    }
}
