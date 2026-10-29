package fr.jarvis.assistant.ui

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import fr.jarvis.assistant.Reglages
import fr.jarvis.assistant.service.EtatJarvis
import fr.jarvis.assistant.service.JarvisService
import fr.jarvis.assistant.stt.GestionModeles

/** Les trois écrans de l'application. */
enum class Ecran { ACCUEIL, PRINCIPAL, REGLAGES }

/**
 * Activité unique. Elle sert aussi d'« activité d'assistant » (lancée par
 * JarvisSession lors d'un appui long sur Accueil) avec l'extra [EXTRA_ECOUTER].
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val pretAuDemarrage = estPret()
        setContent {
            ThemeJarvis {
                var ecran by rememberSaveable {
                    mutableStateOf(if (pretAuDemarrage) Ecran.PRINCIPAL else Ecran.ACCUEIL)
                }
                when (ecran) {
                    Ecran.ACCUEIL -> EcranAccueil(onContinuer = { ecran = Ecran.PRINCIPAL })
                    Ecran.PRINCIPAL -> EcranPrincipal(onReglages = { ecran = Ecran.REGLAGES })
                    Ecran.REGLAGES -> {
                        BackHandler { ecran = Ecran.PRINCIPAL }
                        EcranReglages(onRetour = { ecran = Ecran.PRINCIPAL })
                    }
                }
            }
        }
        if (savedInstanceState == null) traiterIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        traiterIntent(intent)
    }

    override fun onStart() {
        super.onStart()
        EtatJarvis.ihmVisible = true
    }

    override fun onStop() {
        EtatJarvis.ihmVisible = false
        super.onStop()
    }

    /** Micro accordé et modèle présent : le service peut fonctionner. */
    private fun estPret() =
        Autorisations.micro(this) && GestionModeles(this).estInstalle(Reglages(this).modeleId)

    /** Gère les lancements « écouter maintenant » (assistant) et « démarrer » (notification de boot). */
    private fun traiterIntent(intent: Intent?) {
        if (intent == null || !estPret()) return
        when {
            intent.getBooleanExtra(EXTRA_ECOUTER, false) -> JarvisService.ecouter(this)
            intent.getBooleanExtra(EXTRA_DEMARRER, false) -> JarvisService.demarrer(this)
        }
        // On consomme les extras pour ne pas relancer l'écoute après une rotation
        intent.removeExtra(EXTRA_ECOUTER)
        intent.removeExtra(EXTRA_DEMARRER)
    }

    companion object {
        const val EXTRA_ECOUTER = "ecouter"
        const val EXTRA_DEMARRER = "demarrer"
    }
}
