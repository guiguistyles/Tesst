package fr.jarvis.assistant.service

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import fr.jarvis.assistant.R
import fr.jarvis.assistant.ui.MainActivity
import java.util.concurrent.atomic.AtomicInteger

/** Création et mise à jour de toutes les notifications de Jarvis. */
object Notifications {

    private const val CANAL_SERVICE = "jarvis_service"
    private const val CANAL_ACTIONS = "jarvis_actions"
    const val ID_SERVICE = 1
    private const val ID_DEMARRAGE = 2
    private val prochainId = AtomicInteger(100)

    private const val DRAPEAUX = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

    fun creerCanaux(ctx: Context) {
        val gestionnaire = ctx.getSystemService(NotificationManager::class.java)
        gestionnaire.createNotificationChannel(
            NotificationChannel(CANAL_SERVICE, "Écoute en continu", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Notification permanente pendant que Jarvis écoute le mot de réveil"
                setShowBadge(false)
            }
        )
        gestionnaire.createNotificationChannel(
            NotificationChannel(CANAL_ACTIONS, "Actions à confirmer", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Applications à ouvrir quand Jarvis n'a pas le droit de le faire directement"
            }
        )
    }

    /** Notification permanente du service, avec les boutons Pause/Reprendre et Quitter. */
    fun service(ctx: Context, infos: InfosAssistant): Notification {
        val ouvrir = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java), DRAPEAUX)
        val pause = PendingIntent.getService(
            ctx, 1, Intent(ctx, JarvisService::class.java).setAction(JarvisService.ACTION_PAUSE), DRAPEAUX
        )
        val quitter = PendingIntent.getService(
            ctx, 2, Intent(ctx, JarvisService::class.java).setAction(JarvisService.ACTION_QUITTER), DRAPEAUX
        )
        val texte = when {
            infos.enPause -> "En pause — micro libéré"
            infos.etat == Etat.ERREUR -> infos.messageErreur.ifBlank { Etat.ERREUR.libelle }
            else -> infos.etat.libelle
        }
        return NotificationCompat.Builder(ctx, CANAL_SERVICE)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Jarvis")
            .setContentText(texte)
            .setContentIntent(ouvrir)
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(0, if (infos.enPause) "Reprendre" else "Pause", pause)
            .addAction(0, "Quitter", quitter)
            .build()
    }

    /** Notification « touchez pour continuer » quand Android interdit l'ouverture directe d'une activité. */
    fun notifierAction(ctx: Context, description: String, intent: Intent) {
        val id = prochainId.incrementAndGet()
        val pi = PendingIntent.getActivity(ctx, id, intent, DRAPEAUX)
        publier(
            ctx, id,
            NotificationCompat.Builder(ctx, CANAL_ACTIONS)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(description)
                .setContentText("Touchez pour continuer")
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setTimeoutAfter(60_000)
                .build()
        )
    }

    /** Invite à (re)démarrer Jarvis : utilisée au boot et quand Android refuse le démarrage en arrière-plan. */
    fun notifierDemarrage(ctx: Context, message: String) {
        val intent = Intent(ctx, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_DEMARRER, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pi = PendingIntent.getActivity(ctx, ID_DEMARRAGE, intent, DRAPEAUX)
        publier(
            ctx, ID_DEMARRAGE,
            NotificationCompat.Builder(ctx, CANAL_ACTIONS)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("Jarvis")
                .setContentText(message)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build()
        )
    }

    fun mettreAJourService(ctx: Context, infos: InfosAssistant) {
        publier(ctx, ID_SERVICE, service(ctx, infos))
    }

    @SuppressLint("MissingPermission") // vérifiée juste en dessous via areNotificationsEnabled()
    private fun publier(ctx: Context, id: Int, notification: Notification) {
        val gestionnaire = NotificationManagerCompat.from(ctx)
        // Sur Android 13+, sans POST_NOTIFICATIONS, rien ne s'affiche : on ne tente pas
        if (!gestionnaire.areNotificationsEnabled()) return
        try {
            gestionnaire.notify(id, notification)
        } catch (_: SecurityException) {
        }
    }
}
