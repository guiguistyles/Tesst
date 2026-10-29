package fr.jarvis.assistant.ui

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import fr.jarvis.assistant.JarvisApp
import fr.jarvis.assistant.Reglages
import fr.jarvis.assistant.service.EtatJarvis
import fr.jarvis.assistant.service.JarvisService
import fr.jarvis.assistant.stt.CatalogueModeles
import fr.jarvis.assistant.stt.GestionModeles
import fr.jarvis.assistant.stt.InfoModele
import fr.jarvis.assistant.stt.Telechargement
import kotlinx.coroutines.launch

/** Lance le téléchargement d'un modèle dans la portée globale (survit aux changements d'écran). */
fun lancerTelechargement(gestion: GestionModeles, info: InfoModele) {
    if (GestionModeles.telechargement.value is Telechargement.EnCours) return
    JarvisApp.instance.portee.launch {
        try {
            gestion.telecharger(info)
            // Le service attendait peut-être ce modèle : on le recharge
            JarvisService.envoyer(JarvisApp.instance, JarvisService.ACTION_RECHARGER)
        } catch (_: Exception) {
            // L'erreur est publiée dans GestionModeles.telechargement et affichée à l'écran
        }
    }
}

/**
 * Écran d'accueil : guide l'utilisateur pour accorder les autorisations
 * et télécharger le modèle vocal. Affiché tant que l'essentiel manque.
 */
@Composable
fun EcranAccueil(onContinuer: () -> Unit) {
    val ctx = LocalContext.current
    val reglages = remember { Reglages(ctx) }
    val gestion = remember { GestionModeles(ctx) }
    val reprise = rememberCompteurReprise()
    val telechargement by GestionModeles.telechargement.collectAsStateWithLifecycle()
    var rafraichir by remember { mutableIntStateOf(0) }
    var refusMicro by remember { mutableStateOf(false) }
    var refusNotif by remember { mutableStateOf(false) }

    val demandeMicro = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        refusMicro = !it; rafraichir++
    }
    val demandeNotif = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        refusNotif = !it; rafraichir++
    }
    val demandeTelephone = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        rafraichir++
    }

    // Relu à chaque retour des réglages Android, après chaque demande et à la fin d'un téléchargement
    val cle = Triple(reprise, rafraichir, telechargement)
    val micro = remember(cle) { Autorisations.micro(ctx) }
    val notifications = remember(cle) { Autorisations.notifications(ctx) }
    val modeleInstalle = remember(cle) { gestion.estInstalle(reglages.modeleId) }
    val batterie = remember(cle) { Autorisations.batterieIllimitee(ctx) }
    val superposition = remember(cle) { Autorisations.superposition(ctx) }
    val contactsTel = remember(cle) { Autorisations.contacts(ctx) && Autorisations.telephone(ctx) }
    val assistant = remember(cle) { Autorisations.assistantParDefaut(ctx) }
    val essentielOk = micro && notifications && modeleInstalle

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .systemBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        Text("Bienvenue dans Jarvis", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = CouleursJarvis.Veille)
        Text(
            "Quelques étapes pour que l'assistant fonctionne entièrement hors ligne.",
            color = Color(0xFF9FB3C8), modifier = Modifier.padding(bottom = 12.dp)
        )

        CarteEtape(
            "Microphone", "pour entendre « Jarvis » et vos commandes.", micro, true,
            if (refusMicro) "Ouvrir les réglages" else "Autoriser"
        ) {
            if (refusMicro) Autorisations.ouvrir(ctx, Autorisations.intentDetailsAppli(ctx))
            else demandeMicro.launch(Manifest.permission.RECORD_AUDIO)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            CarteEtape(
                "Notifications", "notification permanente avec Pause / Quitter.", notifications, true,
                if (refusNotif) "Ouvrir les réglages" else "Autoriser"
            ) {
                if (refusNotif) Autorisations.ouvrir(ctx, Autorisations.intentDetailsAppli(ctx))
                else demandeNotif.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        val info = CatalogueModeles.parId(reglages.modeleId)
        val enCours = telechargement as? Telechargement.EnCours
        CarteEtape(
            "Modèle vocal français", "${info.nom}, ${info.tailleMo} Mo, téléchargé une seule fois (Wi-Fi conseillé).",
            modeleInstalle, true, if (enCours != null) "Patientez…" else "Télécharger",
            contenuSupplementaire = {
                ContenuTelechargement(telechargement)
            },
        ) { lancerTelechargement(gestion, info) }

        CarteEtape(
            "Batterie sans restriction", "évite qu'Android coupe l'écoute en arrière-plan.", batterie, false,
            "Autoriser"
        ) { Autorisations.ouvrir(ctx, Autorisations.intentBatterie(ctx)) }

        CarteEtape(
            "Affichage par-dessus les autres applis",
            "permet à Jarvis d'ouvrir navigateur, applis et horloge même écran éteint ou depuis une autre appli.",
            superposition, false, "Autoriser"
        ) { Autorisations.ouvrir(ctx, Autorisations.intentSuperposition(ctx)) }

        CarteEtape(
            "Contacts et appels", "pour « appelle Maman ». Sans cela, Jarvis ouvre seulement le composeur.",
            contactsTel, false, "Autoriser"
        ) {
            demandeTelephone.launch(arrayOf(Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE))
        }

        CarteEtape(
            "Assistant numérique par défaut",
            "choisissez Jarvis dans « Assistant numérique » pour l'appui long sur Accueil.",
            assistant, false, "Ouvrir"
        ) { Autorisations.ouvrir(ctx, Autorisations.intentAssistant()) }

        Spacer(Modifier.height(16.dp))
        Button(
            onClick = {
                JarvisService.demarrer(ctx)
                onContinuer()
            },
            enabled = essentielOk,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (essentielOk) "Démarrer Jarvis" else "Complétez les étapes obligatoires") }

        if (EtatJarvis.infos.value.serviceActif) {
            Text("Jarvis est déjà en cours d'exécution.", fontSize = 12.sp, color = Color(0xFF9FB3C8))
        }
    }
}

/** Barre de progression ou message d'erreur du téléchargement en cours. */
@Composable
fun ContenuTelechargement(telechargement: Telechargement) {
    when (telechargement) {
        is Telechargement.EnCours -> {
            Text("${telechargement.etape} : ${(telechargement.progression * 100).toInt()} %", fontSize = 13.sp)
            LinearProgressIndicator(
                progress = { telechargement.progression },
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            )
        }
        is Telechargement.Erreur -> Text("Échec : ${telechargement.message}", color = CouleursJarvis.Erreur, fontSize = 13.sp)
        Telechargement.Aucun -> Unit
    }
}
