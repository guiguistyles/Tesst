package fr.jarvis.assistant.tts

import android.content.Context
import android.media.AudioAttributes
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume

/**
 * Synthèse vocale avec le moteur TextToSpeech natif d'Android, voix fr-FR.
 * [parler] est une fonction suspendue qui ne rend la main qu'une fois la phrase
 * entièrement prononcée : le service peut ainsi rester dans l'état PAROLE
 * pendant exactement la durée de la réponse.
 */
class Synthese(context: Context) : TextToSpeech.OnInitListener {

    private val pret = CompletableDeferred<Boolean>()
    private val enAttente = ConcurrentHashMap<String, CancellableContinuation<Unit>>()
    private val tts = TextToSpeech(context.applicationContext, this)

    override fun onInit(statut: Int) {
        if (statut != TextToSpeech.SUCCESS) {
            Log.e(TAG, "Initialisation TTS impossible ($statut)")
            pret.complete(false)
            return
        }
        val langue = tts.setLanguage(Locale.FRANCE)
        if (langue == TextToSpeech.LANG_MISSING_DATA || langue == TextToSpeech.LANG_NOT_SUPPORTED) {
            Log.e(TAG, "Voix française absente : installez-la dans les réglages TTS")
        }
        // On privilégie une voix française qui fonctionne sans réseau, de la meilleure qualité possible
        try {
            tts.voices
                ?.filter { it.locale.language == "fr" && !it.isNetworkConnectionRequired }
                ?.sortedWith(compareByDescending<android.speech.tts.Voice> { it.locale.country == "FR" }.thenByDescending { it.quality })
                ?.firstOrNull()
                ?.let { tts.voice = it }
        } catch (e: Exception) {
            Log.w(TAG, "Sélection de voix impossible", e)
        }
        tts.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(id: String) {}
            override fun onDone(id: String) = terminer(id)
            override fun onStop(id: String, interrompu: Boolean) = terminer(id)
            @Deprecated("Remplacée par onError(String, Int) mais encore appelée sur certains appareils")
            override fun onError(id: String) = terminer(id)
            override fun onError(id: String, codeErreur: Int) = terminer(id)
        })
        pret.complete(langue != TextToSpeech.LANG_NOT_SUPPORTED)
    }

    private fun terminer(id: String) {
        enAttente.remove(id)?.let { if (it.isActive) it.resume(Unit) }
    }

    /** Prononce [texte] et attend la fin (au plus 30 s). */
    suspend fun parler(texte: String) {
        if (texte.isBlank()) return
        val disponible = withTimeoutOrNull(5_000) { pret.await() } ?: false
        if (!disponible) return
        withTimeoutOrNull(30_000) {
            suspendCancellableCoroutine { suite ->
                val id = UUID.randomUUID().toString()
                enAttente[id] = suite
                suite.invokeOnCancellation {
                    enAttente.remove(id)
                    tts.stop()
                }
                if (tts.speak(texte, TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.ERROR) {
                    terminer(id)
                }
            }
        }
    }

    /** Interrompt la phrase en cours (par exemple si l'utilisateur relance l'écoute). */
    fun interrompre() {
        tts.stop()
        enAttente.keys.toList().forEach { terminer(it) }
    }

    fun liberer() {
        interrompre()
        tts.shutdown()
    }

    companion object {
        private const val TAG = "Synthese"
    }
}
