package fr.jarvis.assistant.commandes

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.AlarmClock
import android.provider.ContactsContract
import android.provider.Settings
import android.util.Log
import androidx.core.content.ContextCompat
import fr.jarvis.assistant.service.EtatJarvis
import fr.jarvis.assistant.service.Notifications
import java.net.URLEncoder

/**
 * Actions système déclenchées par les commandes.
 *
 * Point important (Android 10+) : un service en arrière-plan n'a pas le droit
 * d'ouvrir une activité. On lance donc directement l'activité si l'interface de
 * Jarvis est visible ou si l'autorisation « Afficher par-dessus les autres
 * applications » est accordée ; sinon on affiche une notification sur laquelle
 * il suffit de toucher.
 */
class Actions(context: Context) {

    private val ctx = context.applicationContext
    private val gestionCamera = ctx.getSystemService(CameraManager::class.java)
    private val cameraFlash: String? = trouverCameraFlash()

    /** État connu de la lampe torche (mis à jour par le système). */
    @Volatile
    var lampeAllumee = false
        private set

    init {
        // On suit l'état réel de la lampe (elle peut être allumée depuis les réglages rapides)
        gestionCamera?.registerTorchCallback(object : CameraManager.TorchCallback() {
            override fun onTorchModeChanged(cameraId: String, active: Boolean) {
                if (cameraId == cameraFlash) lampeAllumee = active
            }
        }, Handler(Looper.getMainLooper()))
    }

    // ------------------------------------------------------------ Lancement d'activités

    /** Résultat d'une tentative d'ouverture d'activité. */
    enum class Lancement { OUVERT, NOTIFICATION, IMPOSSIBLE }

    fun lancer(intent: Intent, description: String): Lancement {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (intent.resolveActivity(ctx.packageManager) == null) return Lancement.IMPOSSIBLE
        val autorise = EtatJarvis.ihmVisible || Settings.canDrawOverlays(ctx)
        if (autorise) {
            try {
                ctx.startActivity(intent)
                return Lancement.OUVERT
            } catch (e: ActivityNotFoundException) {
                return Lancement.IMPOSSIBLE
            } catch (e: SecurityException) {
                Log.w(TAG, "Lancement refusé, repli sur notification", e)
            }
        }
        Notifications.notifierAction(ctx, description, intent)
        return Lancement.NOTIFICATION
    }

    // ------------------------------------------------------------ Recherche

    fun rechercherGoogle(requete: String): Lancement {
        val url = "https://www.google.com/search?q=" + URLEncoder.encode(requete, "UTF-8")
        return lancer(Intent(Intent.ACTION_VIEW, Uri.parse(url)), "Recherche : $requete")
    }

    // ------------------------------------------------------------ Applications

    /** Application installée la plus proche du nom prononcé. */
    data class Appli(val nom: String, val paquet: String)

    fun trouverAppli(nomPrononce: String): Appli? {
        val pm = ctx.packageManager
        val principal = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        @Suppress("DEPRECATION")
        val candidates = pm.queryIntentActivities(principal, 0).map {
            Appli(it.loadLabel(pm).toString(), it.activityInfo.packageName)
        }
        return candidates
            .map { it to TexteFr.similarite(nomPrononce, it.nom) }
            .filter { it.second >= SEUIL_SIMILARITE }
            .maxByOrNull { it.second }
            ?.first
    }

    fun ouvrirAppli(appli: Appli): Lancement {
        val intent = ctx.packageManager.getLaunchIntentForPackage(appli.paquet) ?: return Lancement.IMPOSSIBLE
        return lancer(intent, "Ouvrir ${appli.nom}")
    }

    // ------------------------------------------------------------ Téléphone

    data class Contact(val nom: String, val numero: String)

    fun peutLireContacts() = aLaPermission(Manifest.permission.READ_CONTACTS)

    /** Recherche approximative d'un contact par son nom (nécessite READ_CONTACTS). */
    fun trouverContact(nomPrononce: String): Contact? {
        if (!peutLireContacts()) return null
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
        )
        var meilleur: Contact? = null
        var meilleurScore = SEUIL_SIMILARITE
        ctx.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI, projection, null, null, null
        )?.use { curseur ->
            while (curseur.moveToNext()) {
                val nom = curseur.getString(0) ?: continue
                val numero = curseur.getString(1) ?: continue
                // On compare au nom complet et au prénom seul
                val score = maxOf(
                    TexteFr.similarite(nomPrononce, nom),
                    TexteFr.similarite(nomPrononce, nom.substringBefore(' ')),
                )
                if (score > meilleurScore) {
                    meilleurScore = score
                    meilleur = Contact(nom, numero)
                }
            }
        }
        return meilleur
    }

    /** Appel direct si CALL_PHONE est accordée, sinon ouverture du composeur pré-rempli. */
    fun appeler(numero: String?): Lancement {
        val uri = Uri.parse("tel:" + (numero ?: "").replace(" ", ""))
        val intent = if (numero != null && aLaPermission(Manifest.permission.CALL_PHONE)) {
            Intent(Intent.ACTION_CALL, uri)
        } else {
            Intent(Intent.ACTION_DIAL, uri)
        }
        return lancer(intent, if (numero != null) "Appeler $numero" else "Ouvrir le téléphone")
    }

    // ------------------------------------------------------------ Horloge

    fun minuteur(secondes: Int, libelle: String): Lancement {
        val intent = Intent(AlarmClock.ACTION_SET_TIMER)
            .putExtra(AlarmClock.EXTRA_LENGTH, secondes)
            .putExtra(AlarmClock.EXTRA_MESSAGE, libelle)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        return lancer(intent, "Minuteur : $libelle")
    }

    fun alarme(heure: Int, minute: Int): Lancement {
        val intent = Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, heure)
            .putExtra(AlarmClock.EXTRA_MINUTES, minute)
            .putExtra(AlarmClock.EXTRA_MESSAGE, "Jarvis")
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        return lancer(intent, "Alarme à %02d:%02d".format(heure, minute))
    }

    // ------------------------------------------------------------ Lampe torche

    fun aUneLampe() = cameraFlash != null

    /** Allume/éteint la lampe (null = inverser). Retourne le nouvel état, ou null si impossible. */
    fun lampe(allumer: Boolean?): Boolean? {
        val id = cameraFlash ?: return null
        val cible = allumer ?: !lampeAllumee
        return try {
            gestionCamera?.setTorchMode(id, cible)
            lampeAllumee = cible
            cible
        } catch (e: Exception) {
            Log.e(TAG, "Lampe torche indisponible", e)
            null
        }
    }

    private fun trouverCameraFlash(): String? {
        val cameras = gestionCamera ?: return null
        return try {
            cameras.cameraIdList.firstOrNull { id ->
                cameras.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            }
        } catch (e: Exception) {
            null
        }
    }

    private fun aLaPermission(permission: String) =
        ContextCompat.checkSelfPermission(ctx, permission) == PackageManager.PERMISSION_GRANTED

    companion object {
        private const val TAG = "Actions"
        private const val SEUIL_SIMILARITE = 0.6f
    }
}
