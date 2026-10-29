package fr.jarvis.assistant

import android.app.Application
import fr.jarvis.assistant.service.Notifications
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.vosk.LibVosk
import org.vosk.LogLevel

/**
 * Point d'entrée de l'application (créé avant toute activité ou service).
 * - crée les canaux de notification ;
 * - fournit une portée de coroutines qui vit aussi longtemps que le processus
 *   (utilisée par exemple pour le téléchargement du modèle, qui ne doit pas
 *   s'interrompre si l'utilisateur change d'écran).
 */
class JarvisApp : Application() {

    /** Portée globale : survit aux activités, annulée seulement avec le processus. */
    val portee = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    override fun onCreate() {
        super.onCreate()
        instance = this
        Notifications.creerCanaux(this)
        // Vosk est très bavard dans logcat : on ne garde que les avertissements
        LibVosk.setLogLevel(LogLevel.WARNINGS)
    }

    companion object {
        lateinit var instance: JarvisApp
            private set
    }
}
