package fr.jarvis.assistant.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import fr.jarvis.assistant.Reglages

/**
 * Démarrage au boot (optionnel, activable dans les réglages).
 *
 * Depuis Android 11, un service démarré depuis l'arrière-plan (ce qui est le cas au boot)
 * n'a PAS accès au micro (« while-in-use permissions ») ; Android 14 refuse même de le
 * passer au premier plan. Seule solution fiable et conforme : afficher une notification,
 * un toucher suffit à démarrer Jarvis avec un accès micro légitime.
 * Sur Android 8 à 10, on démarre directement le service.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (!Reglages(context).demarrageBoot) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            JarvisService.demarrer(context)
        } else {
            Notifications.notifierDemarrage(context, "Touchez pour activer l'écoute de Jarvis.")
        }
    }
}
