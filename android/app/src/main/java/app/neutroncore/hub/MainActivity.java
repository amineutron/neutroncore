package app.neutroncore.hub;

import android.os.Bundle;
import android.view.View;

import androidx.activity.OnBackPressedCallback;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Mode immersif : barre d'etat et barre de navigation masquees, pour que
 * l'interface occupe tout l'ecran. Elles reapparaissent temporairement si on
 * balaie depuis un bord, puis se remasquent seules.
 *
 * Le contenu passe donc sous le poincon de la camera et sous la zone de geste :
 * les marges de securite sont gerees cote CSS avec env(safe-area-inset-*),
 * ce qui suppose viewport-fit=cover dans index.html.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyImmersiveMode();
        registerBackHandler();
    }

    /**
     * Bouton retour. Depuis Android 16 (API 36) le "retour predictif" est
     * impose. Il faut passer par le dispatcher androidx (et NON par
     * getOnBackInvokedDispatcher directement : AppCompat y enregistre deja son
     * propre rappel, qui gagne, et le notre n'etait jamais appele).
     *
     * On delegue a l'historique de la WebView : l'interface empile une entree
     * a chaque surcouche ouverte (voir App.tsx), donc le retour ferme d'abord
     * ce qui est ouvert et ne quitte qu'une fois l'historique epuise.
     */
    private void registerBackHandler() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                boolean canGoBack = getBridge() != null
                        && getBridge().getWebView() != null
                        && getBridge().getWebView().canGoBack();
                if (canGoBack) {
                    getBridge().getWebView().goBack();
                } else {
                    finish();
                }
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // au retour d'une notification ou du selecteur d'applications, les
        // barres reviennent : on les remasque
        if (hasFocus) {
            applyImmersiveMode();
        }
    }

    private void applyImmersiveMode() {
        View decor = getWindow().getDecorView();
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), decor);
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    }
}
