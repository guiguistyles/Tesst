package fr.jarvis.assistant.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import fr.jarvis.assistant.Reglages
import fr.jarvis.assistant.commandes.Commandes
import fr.jarvis.assistant.service.JarvisService
import fr.jarvis.assistant.stt.CatalogueModeles
import fr.jarvis.assistant.stt.GestionModeles
import fr.jarvis.assistant.stt.Telechargement

private val GrisTexte = Color(0xFF9FB3C8)

/** Écran de réglages : mot de réveil, sensibilité, modèle, démarrage au boot, liste des commandes. */
@Composable
fun EcranReglages(onRetour: () -> Unit) {
    val ctx = LocalContext.current
    val reglages = remember { Reglages(ctx) }
    val gestion = remember { GestionModeles(ctx) }
    val reprise = rememberCompteurReprise()
    val telechargement by GestionModeles.telechargement.collectAsStateWithLifecycle()

    var motReveil by remember { mutableStateOf(reglages.motReveilActif) }
    var sensibilite by remember { mutableFloatStateOf(reglages.sensibilite) }
    var modele by remember { mutableStateOf(reglages.modeleId) }
    var boot by remember { mutableStateOf(reglages.demarrageBoot) }
    var rafraichirModeles by remember { mutableIntStateOf(0) }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .systemBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TextButton(onClick = onRetour) { Text("← Retour") }
            Text("Réglages", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = CouleursJarvis.Veille)
        }

        // --- Mot de réveil
        Section("Mot de réveil") {
            LigneInterrupteur(
                "Écoute continue de « Jarvis »",
                "Désactivé : utilisez le bouton « Parler » ou l'appui long sur Accueil.",
                motReveil
            ) { motReveil = it; reglages.motReveilActif = it }

            Text("Sensibilité : ${(sensibilite * 100).toInt()} %", modifier = Modifier.padding(top = 8.dp))
            Slider(
                value = sensibilite,
                onValueChange = { sensibilite = it },
                onValueChangeFinished = { reglages.sensibilite = sensibilite },
                steps = 9,
            )
            Text(
                "Faible = moins de déclenchements intempestifs. À partir de 70 % : détection " +
                    "immédiate (plus réactive, plus de faux positifs).",
                fontSize = 12.sp, color = GrisTexte
            )
        }

        // --- Modèle de reconnaissance
        Section("Modèle de reconnaissance (Vosk, hors ligne)") {
            val cle = Triple(reprise, rafraichirModeles, telechargement)
            CatalogueModeles.liste.forEach { info ->
                val installe = remember(cle) { gestion.estInstalle(info.id) }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    RadioButton(
                        selected = modele == info.id,
                        enabled = installe,
                        onClick = {
                            modele = info.id
                            reglages.modeleId = info.id
                            JarvisService.envoyer(ctx, JarvisService.ACTION_RECHARGER)
                        },
                    )
                    Column(Modifier.weight(1f)) {
                        Text(info.nom)
                        Text("${info.tailleMo} Mo — ${info.description}", fontSize = 12.sp, color = GrisTexte)
                    }
                }
                Row(Modifier.fillMaxWidth().padding(start = 48.dp, bottom = 8.dp)) {
                    val enCours = (telechargement as? Telechargement.EnCours)?.id == info.id
                    when {
                        enCours -> ContenuTelechargement(telechargement)
                        installe -> OutlinedButton(
                            enabled = modele != info.id,
                            onClick = { gestion.supprimer(info.id); rafraichirModeles++ },
                        ) { Text("Supprimer") }
                        else -> OutlinedButton(onClick = { lancerTelechargement(gestion, info) }) {
                            Text("Télécharger")
                        }
                    }
                }
            }
            (telechargement as? Telechargement.Erreur)?.let {
                Text("Dernier échec : ${it.message}", color = CouleursJarvis.Erreur, fontSize = 12.sp)
            }
            Text(
                "Installation manuelle possible : copiez le dossier décompressé dans\n${gestion.dossierRacine.absolutePath}/<nom du modèle>",
                fontSize = 12.sp, color = GrisTexte
            )
        }

        // --- Système
        Section("Système") {
            LigneInterrupteur(
                "Démarrage avec le téléphone",
                "Au démarrage, une notification permet d'activer Jarvis d'un toucher (exigence d'Android 11+).",
                boot
            ) { boot = it; reglages.demarrageBoot = it }

            val assistant = remember(reprise) { Autorisations.assistantParDefaut(ctx) }
            val batterie = remember(reprise) { Autorisations.batterieIllimitee(ctx) }
            LigneBouton(
                "Assistant numérique par défaut",
                if (assistant) "Jarvis est l'assistant par défaut." else "Choisissez Jarvis dans « Assistant numérique ».",
                "Ouvrir"
            ) { Autorisations.ouvrir(ctx, Autorisations.intentAssistant()) }
            LigneBouton(
                "Optimisation de batterie",
                if (batterie) "Jarvis n'est pas restreint." else "Android peut couper l'écoute en arrière-plan.",
                if (batterie) "Détails" else "Désactiver"
            ) {
                Autorisations.ouvrir(ctx, if (batterie) Autorisations.intentDetailsAppli(ctx) else Autorisations.intentBatterie(ctx))
            }
            LigneBouton("Arrêter Jarvis", "Coupe l'écoute et retire la notification.", "Arrêter") {
                JarvisService.envoyer(ctx, JarvisService.ACTION_QUITTER)
            }
        }

        // --- Commandes disponibles
        Section("Commandes disponibles") {
            Commandes.liste.forEach { commande ->
                Text(commande.nom, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 6.dp))
                commande.exemples.forEach {
                    Text("« $it »", fontSize = 13.sp, fontStyle = FontStyle.Italic, color = GrisTexte)
                }
            }
            Text(
                "Pour en ajouter : fichier commandes/Commandes.kt.",
                fontSize = 12.sp, color = GrisTexte, modifier = Modifier.padding(top = 8.dp)
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun Section(titre: String, contenu: @Composable () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(12.dp))
            .padding(14.dp)
    ) {
        Text(titre, color = CouleursJarvis.Veille, fontWeight = FontWeight.Bold)
        HorizontalDivider(Modifier.padding(vertical = 6.dp), color = Color(0xFF1E2E3E))
        contenu()
    }
}

@Composable
private fun LigneInterrupteur(titre: String, detail: String, valeur: Boolean, onChange: (Boolean) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(Modifier.weight(1f)) {
            Text(titre)
            Text(detail, fontSize = 12.sp, color = GrisTexte)
        }
        Switch(checked = valeur, onCheckedChange = onChange)
    }
}

@Composable
private fun LigneBouton(titre: String, detail: String, bouton: String, onClick: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(Modifier.weight(1f)) {
            Text(titre)
            Text(detail, fontSize = 12.sp, color = GrisTexte)
        }
        OutlinedButton(onClick = onClick) { Text(bouton) }
    }
}
