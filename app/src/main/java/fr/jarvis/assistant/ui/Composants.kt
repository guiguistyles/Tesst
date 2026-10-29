package fr.jarvis.assistant.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect

/**
 * Compteur incrémenté à chaque retour au premier plan : permet de relire l'état
 * des autorisations quand l'utilisateur revient des réglages Android.
 */
@Composable
fun rememberCompteurReprise(): Int {
    var compteur by remember { mutableIntStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { compteur++ }
    return compteur
}

/** Carte « autorisation » : titre, explication, statut et bouton d'action. */
@Composable
fun CarteEtape(
    titre: String,
    explication: String,
    ok: Boolean,
    obligatoire: Boolean,
    libelleBouton: String,
    contenuSupplementaire: @Composable () -> Unit = {},
    onClick: () -> Unit,
) {
    val couleurStatut = when {
        ok -> CouleursJarvis.Ecoute
        obligatoire -> CouleursJarvis.Reflexion
        else -> CouleursJarvis.Chargement
    }
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp)
            .background(MaterialTheme.colorScheme.surface, RoundedCornerShape(12.dp))
            .padding(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (ok) "✔" else if (obligatoire) "●" else "○",
                color = couleurStatut, fontSize = 18.sp
            )
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(titre, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                Text(
                    (if (obligatoire) "Obligatoire — " else "Recommandé — ") + explication,
                    fontSize = 13.sp, color = Color(0xFF9FB3C8)
                )
            }
        }
        contenuSupplementaire()
        if (!ok) {
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.End) {
                OutlinedButton(onClick = onClick) { Text(libelleBouton) }
            }
        }
    }
}
