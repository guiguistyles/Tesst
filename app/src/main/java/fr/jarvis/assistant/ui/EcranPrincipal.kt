package fr.jarvis.assistant.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import fr.jarvis.assistant.Reglages
import fr.jarvis.assistant.service.Etat
import fr.jarvis.assistant.service.EtatJarvis
import fr.jarvis.assistant.service.JarvisService

/** Écran principal plein écran sombre : cercle animé, état, dernière phrase et réponse. */
@Composable
fun EcranPrincipal(onReglages: () -> Unit) {
    val ctx = LocalContext.current
    val reglages = remember { Reglages(ctx) }
    val infos by EtatJarvis.infos.collectAsStateWithLifecycle()
    val couleur = CouleursJarvis.pour(infos.etat)

    // L'écran principal garantit que le service tourne (on est au premier plan : c'est autorisé)
    LaunchedEffect(Unit) {
        if (!EtatJarvis.infos.value.serviceActif) JarvisService.demarrer(ctx)
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(CouleursJarvis.Fond)
            .systemBarsPadding()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "J.A.R.V.I.S.", color = couleur, fontSize = 20.sp,
                fontWeight = FontWeight.Light, letterSpacing = 6.sp
            )
            Spacer(Modifier.weight(1f))
            TextButton(onClick = onReglages) { Text("⚙ Réglages", color = Color(0xFF9FB3C8)) }
        }

        CercleJarvis(
            etat = infos.etat,
            niveauMicro = infos.niveauMicro,
            modifier = Modifier.fillMaxWidth().weight(1f),
        )

        // Texte d'état
        val libelle = when {
            !infos.serviceActif -> "Jarvis est arrêté"
            infos.enPause -> "En pause"
            infos.etat == Etat.ERREUR -> infos.messageErreur.ifBlank { Etat.ERREUR.libelle }
            infos.etat == Etat.VEILLE && !reglages.motReveilActif -> "En veille — touchez « Parler »"
            else -> infos.etat.libelle
        }
        Text(libelle, color = couleur, fontSize = 18.sp, textAlign = TextAlign.Center)

        Column(
            Modifier.fillMaxWidth().heightIn(min = 96.dp).padding(vertical = 12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            if (infos.etat == Etat.ECOUTE && infos.partielle.isNotBlank()) {
                Text(infos.partielle, color = Color.White, fontSize = 16.sp, textAlign = TextAlign.Center)
            } else if (infos.derniereTranscription.isNotBlank()) {
                Text(
                    "« ${infos.derniereTranscription} »", color = Color.White, fontSize = 16.sp,
                    fontStyle = FontStyle.Italic, textAlign = TextAlign.Center
                )
            }
            // Problème de voix : on le signale ici, le détail est dans les réglages
            if (infos.serviceActif && !infos.voixOk && infos.etatVoix.isNotBlank()) {
                Text(
                    "🔇 " + infos.etatVoix, color = CouleursJarvis.Reflexion, fontSize = 13.sp,
                    textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 6.dp)
                )
            }
            if (infos.derniereReponse.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(infos.derniereReponse, color = Color(0xFF9FB3C8), fontSize = 14.sp, textAlign = TextAlign.Center)
            }
        }

        Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth()) {
            if (!infos.serviceActif) {
                Button(onClick = { JarvisService.demarrer(ctx) }) { Text("Démarrer Jarvis") }
            } else {
                // Équivalent de la touche F9 de la version Windows
                Button(
                    onClick = { JarvisService.ecouter(ctx) },
                    colors = ButtonDefaults.buttonColors(containerColor = CouleursJarvis.Ecoute),
                ) { Text("🎤 Parler", color = Color.Black) }
                Spacer(Modifier.width(12.dp))
                OutlinedButton(onClick = { JarvisService.envoyer(ctx, JarvisService.ACTION_PAUSE) }) {
                    Text(if (infos.enPause) "Reprendre" else "Pause")
                }
            }
        }
    }
}
