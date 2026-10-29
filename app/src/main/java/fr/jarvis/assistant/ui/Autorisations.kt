package fr.jarvis.assistant.ui

import android.Manifest
import android.annotation.SuppressLint
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat

/** Vérification des autorisations et intents vers les écrans de réglages Android. */
object Autorisations {

    private fun accordee(ctx: Context, permission: String) =
        ContextCompat.checkSelfPermission(ctx, permission) == PackageManager.PERMISSION_GRANTED

    fun micro(ctx: Context) = accordee(ctx, Manifest.permission.RECORD_AUDIO)

    /** POST_NOTIFICATIONS n'existe qu'à partir d'Android 13. */
    fun notifications(ctx: Context) =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || accordee(ctx, Manifest.permission.POST_NOTIFICATIONS)

    fun contacts(ctx: Context) = accordee(ctx, Manifest.permission.READ_CONTACTS)
    fun telephone(ctx: Context) = accordee(ctx, Manifest.permission.CALL_PHONE)

    fun batterieIllimitee(ctx: Context) =
        ctx.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(ctx.packageName)

    fun superposition(ctx: Context) = Settings.canDrawOverlays(ctx)

    /** Jarvis est-il l'assistant numérique par défaut ? */
    fun assistantParDefaut(ctx: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ctx.getSystemService(RoleManager::class.java).isRoleHeld(RoleManager.ROLE_ASSISTANT)
        } else {
            Settings.Secure.getString(ctx.contentResolver, "assistant")?.contains(ctx.packageName) == true
        }

    /** Demande d'exemption d'optimisation de batterie (fenêtre système Oui/Non). */
    @SuppressLint("BatteryLife") // usage personnel : l'écoute continue le justifie
    fun intentBatterie(ctx: Context) =
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${ctx.packageName}"))

    fun intentSuperposition(ctx: Context) =
        Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${ctx.packageName}"))

    /** Écran « Applications par défaut » (contient « Assistant numérique »). */
    fun intentAssistant() = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)

    /** Réglages Android de synthèse vocale (moteur, langue, téléchargement des voix). */
    fun intentSyntheseVocale() = Intent("com.android.settings.TTS_SETTINGS")

    /** Fiche de l'application (si une permission a été refusée définitivement). */
    fun intentDetailsAppli(ctx: Context) =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${ctx.packageName}"))

    /** Ouvre un écran de réglages en se rabattant sur la fiche de l'appli si besoin. */
    fun ouvrir(ctx: Context, intent: Intent) {
        try {
            ctx.startActivity(intent)
        } catch (e: Exception) {
            try {
                ctx.startActivity(intentDetailsAppli(ctx))
            } catch (_: Exception) {
            }
        }
    }
}
