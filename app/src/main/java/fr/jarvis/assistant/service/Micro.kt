package fr.jarvis.assistant.service

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Micro unique de l'application : UN SEUL AudioRecord, partagé entre la détection
 * du mot de réveil et l'enregistrement de la commande. Le service lit les trames
 * et les distribue au bon consommateur selon l'état courant ; il n'y a donc
 * jamais deux captures concurrentes (ce qu'Android refuse souvent).
 *
 * Toutes les méthodes doivent être appelées depuis le même thread (thread audio du service).
 */
class Micro {

    private var enregistreur: AudioRecord? = null

    /** Ouvre le micro si besoin et lance la capture. Retourne false en cas d'échec. */
    @SuppressLint("MissingPermission") // la permission est vérifiée par le service avant démarrage
    fun demarrer(): Boolean {
        val existant = enregistreur
        if (existant != null) {
            if (existant.recordingState != AudioRecord.RECORDSTATE_RECORDING) existant.startRecording()
            return existant.recordingState == AudioRecord.RECORDSTATE_RECORDING
        }
        val minimum = AudioRecord.getMinBufferSize(FREQUENCE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        if (minimum <= 0) return false
        val nouvel = try {
            AudioRecord(
                // VOICE_RECOGNITION : pas de traitement agressif, idéal pour la reconnaissance
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                FREQUENCE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                max(minimum, TAILLE_TRAME * 2 * 4),
            )
        } catch (e: Exception) {
            Log.e(TAG, "Création AudioRecord impossible", e)
            return false
        }
        if (nouvel.state != AudioRecord.STATE_INITIALIZED) {
            nouvel.release()
            return false
        }
        nouvel.startRecording()
        enregistreur = nouvel
        return nouvel.recordingState == AudioRecord.RECORDSTATE_RECORDING
    }

    /** Lecture bloquante d'une trame (100 ms). Retourne le nombre d'échantillons lus ou < 0. */
    fun lire(tampon: ShortArray): Int = enregistreur?.read(tampon, 0, tampon.size) ?: -1

    /** Suspend la capture sans libérer la ressource (le point vert disparaît). */
    fun arreter() {
        enregistreur?.let { if (it.recordingState == AudioRecord.RECORDSTATE_RECORDING) it.stop() }
    }

    /** Libère définitivement le micro. */
    fun liberer() {
        enregistreur?.let {
            try {
                arreter()
            } catch (_: Exception) {
            }
            it.release()
        }
        enregistreur = null
    }

    /**
     * Android 10+ peut « faire taire » une capture (micro coupé dans les réglages rapides,
     * service lancé depuis l'arrière-plan…). On reçoit alors du silence sans erreur.
     */
    fun estReduitAuSilence(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
        return enregistreur?.activeRecordingConfiguration?.isClientSilenced == true
    }

    companion object {
        private const val TAG = "Micro"
        /** Fréquence attendue par les modèles Vosk. */
        const val FREQUENCE = 16_000
        /** 1600 échantillons = 100 ms de son. */
        const val TAILLE_TRAME = 1_600

        /** Niveau sonore entre 0 et 1, sur une échelle de -60 dB à 0 dB. */
        fun niveau(tampon: ShortArray, n: Int): Float {
            if (n <= 0) return 0f
            var somme = 0.0
            for (i in 0 until n) {
                val v = tampon[i].toDouble()
                somme += v * v
            }
            val rms = sqrt(somme / n) / 32768.0
            if (rms <= 1e-6) return 0f
            val db = 20 * log10(rms)
            return ((db + 60) / 60).toFloat().coerceIn(0f, 1f)
        }
    }
}
