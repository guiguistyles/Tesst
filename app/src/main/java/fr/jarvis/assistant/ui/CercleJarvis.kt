package fr.jarvis.assistant.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import fr.jarvis.assistant.service.Etat
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Cercle animé façon Jarvis, dessiné entièrement avec Canvas :
 * halo lumineux, graduations, anneaux en rotation (vitesse selon l'état)
 * et noyau pulsant (lié au volume du micro pendant l'écoute).
 */
@Composable
fun CercleJarvis(etat: Etat, niveauMicro: Float, modifier: Modifier = Modifier) {
    // Transitions douces entre états
    val couleur by animateColorAsState(CouleursJarvis.pour(etat), tween(600), label = "couleur")
    val niveau by animateFloatAsState(
        niveauMicro, spring(stiffness = Spring.StiffnessMediumLow), label = "niveau"
    )
    val vitesse by animateFloatAsState(
        when (etat) {
            Etat.CHARGEMENT -> 0.5f
            Etat.VEILLE -> 1f
            Etat.ECOUTE -> 1.6f
            Etat.REFLEXION -> 5f // anneaux rapides
            Etat.PAROLE -> 1.3f
            Etat.ERREUR -> 0.15f
        },
        tween(800), label = "vitesse"
    )

    // Horloge d'animation : on intègre la vitesse pour éviter les sauts d'angle
    var angle by remember { mutableFloatStateOf(0f) }
    var temps by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(Unit) {
        var precedent = 0L
        while (true) {
            withFrameNanos { t ->
                if (precedent != 0L) {
                    val dt = ((t - precedent) / 1_000_000_000f).coerceAtMost(0.1f)
                    angle = (angle + dt * 45f * vitesse) % 36_000f
                    temps += dt
                }
                precedent = t
            }
        }
    }

    // Amplitude de pulsation du noyau selon l'état
    val pulsation = when (etat) {
        Etat.CHARGEMENT -> 0.04f * sin(temps * 1.5f)
        Etat.VEILLE -> 0.03f * sin(temps * 2f)
        Etat.ECOUTE -> 0.05f * sin(temps * 4f) + 0.35f * niveau
        Etat.REFLEXION -> 0.05f * sin(temps * 8f)
        // Parole : modulation irrégulière qui imite le rythme de la voix
        Etat.PAROLE -> 0.18f * (0.5f + 0.5f * sin(temps * 11f)) * (0.6f + 0.4f * sin(temps * 3.3f))
        Etat.ERREUR -> 0f
    }

    Canvas(modifier) {
        val c = center
        val r = size.minDimension / 2f * 0.6f
        val p = 1f + pulsation

        // 1) Halo
        val rayonHalo = r * 1.9f * p
        drawCircle(
            brush = Brush.radialGradient(
                listOf(couleur.copy(alpha = 0.35f + 0.25f * pulsation.coerceIn(0f, 1f)), Color.Transparent),
                center = c, radius = rayonHalo
            ),
            radius = rayonHalo, center = c
        )

        // 2) Graduations extérieures, rotation lente inverse
        rotate(-angle * 0.3f, c) {
            for (i in 0 until 72) {
                val a = (i * 5f) * (PI.toFloat() / 180f)
                val longue = i % 6 == 0
                val r1 = r * 1.30f
                val r2 = r * (if (longue) 1.40f else 1.35f)
                drawLine(
                    color = couleur.copy(alpha = if (longue) 0.9f else 0.45f),
                    start = Offset(c.x + r1 * cos(a), c.y + r1 * sin(a)),
                    end = Offset(c.x + r2 * cos(a), c.y + r2 * sin(a)),
                    strokeWidth = r * (if (longue) 0.012f else 0.007f),
                )
            }
        }

        // 3) Grand anneau : 3 arcs épais
        rotate(angle, c) {
            for (k in 0 until 3) arc(couleur, r * 1.15f, k * 120f, 70f, r * 0.045f, 0.9f)
        }
        // 4) Anneau moyen : 4 arcs fins, sens inverse et plus rapide
        rotate(-angle * 1.7f, c) {
            for (k in 0 until 4) arc(couleur, r * 0.98f, k * 90f + 20f, 50f, r * 0.02f, 0.75f)
        }
        // 5) Anneau intérieur en pointillés, très rapide
        rotate(angle * 2.4f, c) {
            drawCircle(
                color = couleur.copy(alpha = 0.6f),
                radius = r * 0.80f,
                center = c,
                style = Stroke(
                    width = r * 0.012f,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(r * 0.06f, r * 0.04f))
                )
            )
        }

        // 6) Noyau pulsant
        val rayonNoyau = r * 0.55f * p
        drawCircle(
            brush = Brush.radialGradient(
                listOf(Color.White.copy(alpha = 0.95f), couleur, couleur.copy(alpha = 0.15f)),
                center = c, radius = rayonNoyau
            ),
            radius = rayonNoyau, center = c
        )
        drawCircle(couleur, radius = rayonNoyau, center = c, style = Stroke(width = r * 0.015f))
    }
}

/** Dessine un arc de cercle centré. */
private fun DrawScope.arc(couleur: Color, rayon: Float, debut: Float, balayage: Float, epaisseur: Float, alpha: Float) {
    drawArc(
        color = couleur.copy(alpha = alpha),
        startAngle = debut,
        sweepAngle = balayage,
        useCenter = false,
        topLeft = Offset(center.x - rayon, center.y - rayon),
        size = Size(rayon * 2, rayon * 2),
        style = Stroke(width = epaisseur, cap = StrokeCap.Round),
    )
}
