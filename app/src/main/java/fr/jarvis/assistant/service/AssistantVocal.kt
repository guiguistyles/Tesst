package fr.jarvis.assistant.service

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.RemoteException
import android.service.voice.VoiceInteractionService
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import android.speech.RecognitionService
import android.speech.SpeechRecognizer
import android.util.Log
import fr.jarvis.assistant.ui.MainActivity

/*
 * Intégration comme « Assistant numérique » par défaut.
 *
 * Android exige trois composants (déclarés dans le manifeste et res/xml/voice_interaction.xml) :
 *  1. un VoiceInteractionService : le service « assistant », lié par le système ;
 *  2. un VoiceInteractionSessionService qui crée une session à chaque appui long
 *     sur Accueil / Alimentation ;
 *  3. un RecognitionService (obligatoire dans la déclaration, sinon Jarvis n'apparaît pas
 *     dans la liste des assistants).
 */

/** Service assistant : il ne fait rien de particulier, le système le garde lié tant que Jarvis est l'assistant. */
class JarvisVoiceInteractionService : VoiceInteractionService() {

    override fun onReady() {
        super.onReady()
        Log.i(TAG, "Jarvis est l'assistant numérique actif")
    }

    /** Lancement depuis l'écran verrouillé (bouton assistant). */
    override fun onLaunchVoiceAssistFromKeyguard() {
        startActivity(
            Intent(this, MainActivity::class.java)
                .putExtra(MainActivity.EXTRA_ECOUTER, true)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
    }

    companion object {
        private const val TAG = "JarvisAssistant"
    }
}

/** Fabrique de sessions. */
class JarvisSessionService : VoiceInteractionSessionService() {
    override fun onNewSession(args: Bundle?): VoiceInteractionSession = JarvisSession(this)
}

/**
 * Session créée à chaque invocation (appui long). Plutôt qu'une fenêtre système,
 * on ouvre l'activité principale comme « activité d'assistant » : elle est visible,
 * donc autorisée à démarrer le service micro, et lance immédiatement l'écoute.
 */
class JarvisSession(context: Context) : VoiceInteractionSession(context) {

    override fun onPrepareShow(args: Bundle?, showFlags: Int) {
        super.onPrepareShow(args, showFlags)
        setUiEnabled(false) // pas de fenêtre de session : on utilise notre activité
    }

    override fun onShow(args: Bundle?, showFlags: Int) {
        super.onShow(args, showFlags)
        startAssistantActivity(
            Intent(context, MainActivity::class.java).putExtra(MainActivity.EXTRA_ECOUTER, true)
        )
    }
}

/**
 * Service de reconnaissance exigé par la déclaration d'assistant.
 * Jarvis utilise son propre moteur dans JarvisService : ce service répond simplement
 * « indisponible » aux autres applications qui voudraient l'utiliser comme clavier vocal.
 * (Amélioration possible : y brancher Vosk pour offrir la dictée hors ligne à tout le système.)
 */
class JarvisRecognitionService : RecognitionService() {

    override fun onStartListening(intent: Intent?, listener: Callback) {
        try {
            listener.error(SpeechRecognizer.ERROR_RECOGNIZER_BUSY)
        } catch (_: RemoteException) {
        }
    }

    override fun onCancel(listener: Callback) {}

    override fun onStopListening(listener: Callback) {}
}
