package fr.jarvis.assistant.stt

import android.content.Context
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.vosk.Model
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.zip.ZipInputStream
import kotlin.coroutines.coroutineContext

/** Description d'un modèle Vosk téléchargeable. */
data class InfoModele(
    val id: String,
    val nom: String,
    val description: String,
    val tailleMo: Int,
    val url: String,
)

/** Liste des modèles proposés dans les réglages. */
object CatalogueModeles {
    val liste = listOf(
        InfoModele(
            id = "vosk-model-small-fr-0.22",
            nom = "Français léger 0.22 (recommandé)",
            description = "Bon compromis vitesse/précision, ~300 Mo de RAM, temps réel sur milieu de gamme.",
            tailleMo = 41,
            url = "https://alphacephei.com/vosk/models/vosk-model-small-fr-0.22.zip",
        ),
        InfoModele(
            id = "vosk-model-small-fr-pguyot-0.3",
            nom = "Français léger pguyot 0.3",
            description = "Alternative communautaire, vocabulaire légèrement différent.",
            tailleMo = 39,
            url = "https://alphacephei.com/vosk/models/vosk-model-small-fr-pguyot-0.3.zip",
        ),
    )

    fun parId(id: String): InfoModele = liste.firstOrNull { it.id == id } ?: liste.first()
}

/** Progression d'un téléchargement, observée par l'interface. */
sealed class Telechargement {
    data object Aucun : Telechargement()
    data class EnCours(val id: String, val progression: Float, val etape: String) : Telechargement()
    data class Erreur(val id: String, val message: String) : Telechargement()
}

/**
 * Gestion des modèles sur le stockage :
 * - emplacement : /sdcard/Android/data/fr.jarvis.assistant/files/modeles/<id>/
 *   (accessible par « adb push » pour une installation manuelle sans Internet) ;
 * - téléchargement + décompression ;
 * - chargement en mémoire.
 */
class GestionModeles(context: Context) {

    private val appContext = context.applicationContext

    /** Dossier racine des modèles (stockage externe privé, ou interne en secours). */
    val dossierRacine: File =
        (appContext.getExternalFilesDir(null) ?: appContext.filesDir).let { File(it, "modeles") }

    fun dossier(id: String) = File(dossierRacine, id)

    /**
     * Retrouve le vrai dossier du modèle : on accepte aussi un niveau d'imbrication
     * (cas d'un « adb push » du dossier parent par erreur).
     */
    fun racineModele(id: String): File? {
        val base = dossier(id)
        if (estUnModele(base)) return base
        return base.listFiles()?.firstOrNull { it.isDirectory && estUnModele(it) }
    }

    fun estInstalle(id: String): Boolean = racineModele(id) != null

    private fun estUnModele(dossier: File) =
        File(dossier, "am/final.mdl").exists() && File(dossier, "conf").isDirectory

    fun supprimer(id: String) {
        dossier(id).deleteRecursively()
    }

    /** Charge le modèle en mémoire (2 à 10 s selon le téléphone). À appeler hors thread principal. */
    suspend fun charger(id: String): Model = withContext(Dispatchers.IO) {
        val racine = racineModele(id) ?: throw IOException("Modèle « $id » non installé")
        Model(racine.absolutePath)
    }

    /** Télécharge puis décompresse le modèle. Lève une exception en cas d'échec. */
    suspend fun telecharger(info: InfoModele) = withContext(Dispatchers.IO) {
        val zip = File(appContext.cacheDir, "${info.id}.zip")
        val temporaire = File(dossierRacine, "${info.id}.tmp")
        try {
            publier(Telechargement.EnCours(info.id, 0f, "Téléchargement"))
            telechargerFichier(info, zip)
            publier(Telechargement.EnCours(info.id, 0f, "Décompression"))
            temporaire.deleteRecursively()
            decompresser(info.id, zip, temporaire)
            val destination = dossier(info.id)
            destination.deleteRecursively()
            if (!temporaire.renameTo(destination)) throw IOException("Impossible de finaliser l'installation")
            if (!estInstalle(info.id)) throw IOException("Archive inattendue : modèle introuvable")
            publier(Telechargement.Aucun)
        } catch (e: Exception) {
            Log.e(TAG, "Échec du téléchargement", e)
            temporaire.deleteRecursively()
            publier(Telechargement.Erreur(info.id, e.message ?: e.javaClass.simpleName))
            throw e
        } finally {
            zip.delete()
        }
    }

    private suspend fun telechargerFichier(info: InfoModele, destination: File) {
        var connexion = URL(info.url).openConnection() as HttpURLConnection
        connexion.connectTimeout = 15_000
        connexion.readTimeout = 30_000
        // Redirections manuelles (HttpURLConnection ne suit pas http -> https)
        var redirections = 0
        while (connexion.responseCode in 300..399 && redirections < 5) {
            val cible = connexion.getHeaderField("Location") ?: break
            connexion.disconnect()
            connexion = URL(URL(info.url), cible).openConnection() as HttpURLConnection
            redirections++
        }
        if (connexion.responseCode != HttpURLConnection.HTTP_OK) {
            throw IOException("Erreur HTTP ${connexion.responseCode}")
        }
        val total = connexion.contentLengthLong.takeIf { it > 0 } ?: (info.tailleMo * 1_000_000L)
        connexion.inputStream.use { entree ->
            destination.outputStream().use { sortie ->
                val tampon = ByteArray(64 * 1024)
                var lu = 0L
                var dernierPourcent = -1
                while (true) {
                    coroutineContext.ensureActive()
                    val n = entree.read(tampon)
                    if (n < 0) break
                    sortie.write(tampon, 0, n)
                    lu += n
                    val pourcent = (lu * 100 / total).toInt()
                    if (pourcent != dernierPourcent) {
                        dernierPourcent = pourcent
                        publier(Telechargement.EnCours(info.id, (lu.toFloat() / total).coerceIn(0f, 1f), "Téléchargement"))
                    }
                }
            }
        }
        connexion.disconnect()
    }

    /**
     * Décompresse l'archive en supprimant le dossier de premier niveau
     * (les zips Vosk contiennent « vosk-model-xxx/am/... »).
     * Protégé contre le « zip slip » (chemins en ../).
     */
    private suspend fun decompresser(id: String, zip: File, destination: File) {
        destination.mkdirs()
        val racineCanonique = destination.canonicalPath + File.separator
        val total = zip.length().toFloat()
        var traite = 0L
        ZipInputStream(zip.inputStream().buffered()).use { entree ->
            while (true) {
                coroutineContext.ensureActive()
                val element = entree.nextEntry ?: break
                val chemin = element.name.substringAfter('/', element.name)
                if (chemin.isEmpty()) continue
                val fichier = File(destination, chemin)
                if (!fichier.canonicalPath.startsWith(racineCanonique)) {
                    throw IOException("Entrée d'archive invalide : ${element.name}")
                }
                if (element.isDirectory) {
                    fichier.mkdirs()
                } else {
                    fichier.parentFile?.mkdirs()
                    fichier.outputStream().use { sortie -> entree.copyTo(sortie) }
                }
                traite += element.compressedSize.coerceAtLeast(0)
                publier(Telechargement.EnCours(id, (traite / total).coerceIn(0f, 1f), "Décompression"))
            }
        }
    }

    companion object {
        private const val TAG = "GestionModeles"

        private val _telechargement = MutableStateFlow<Telechargement>(Telechargement.Aucun)
        /** État du téléchargement en cours, partagé dans tout le processus. */
        val telechargement: StateFlow<Telechargement> = _telechargement.asStateFlow()

        private fun publier(etat: Telechargement) {
            _telechargement.value = etat
        }
    }
}
