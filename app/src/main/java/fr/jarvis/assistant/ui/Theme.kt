package fr.jarvis.assistant.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import fr.jarvis.assistant.service.Etat

/** Couleurs de Jarvis, une par état (valeurs RVB demandées). */
object CouleursJarvis {
    val Fond = Color(0xFF02060A)
    val Surface = Color(0xFF0B1620)
    val Chargement = Color(110, 130, 160)  // gris-bleu
    val Veille = Color(0, 170, 255)        // cyan
    val Ecoute = Color(0, 255, 225)        // turquoise
    val Reflexion = Color(255, 175, 0)     // ambre
    val Parole = Color(0, 200, 255)        // cyan lumineux
    val Erreur = Color(255, 70, 70)        // rouge

    fun pour(etat: Etat): Color = when (etat) {
        Etat.CHARGEMENT -> Chargement
        Etat.VEILLE -> Veille
        Etat.ECOUTE -> Ecoute
        Etat.REFLEXION -> Reflexion
        Etat.PAROLE -> Parole
        Etat.ERREUR -> Erreur
    }
}

private val schemaSombre = darkColorScheme(
    primary = CouleursJarvis.Veille,
    secondary = CouleursJarvis.Ecoute,
    tertiary = CouleursJarvis.Reflexion,
    background = CouleursJarvis.Fond,
    surface = CouleursJarvis.Surface,
    error = CouleursJarvis.Erreur,
    onPrimary = Color.Black,
    onBackground = Color(0xFFDDEEFF),
    onSurface = Color(0xFFDDEEFF),
)

@Composable
fun ThemeJarvis(contenu: @Composable () -> Unit) {
    MaterialTheme(colorScheme = schemaSombre, content = contenu)
}
