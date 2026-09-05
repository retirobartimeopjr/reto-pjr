import { useEffect, useRef } from 'react';
import { getCurrentUser, logoutUser } from '../store/userStore';
import { APP_VERSION } from '../config/version';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export default function SessionWatcher() {
    const lastCheckTime = useRef<number>(0);
    const isChecking = useRef<boolean>(false);

    useEffect(() => {
        // Function to perform the actual check
        const performCheck = async () => {
            if (isChecking.current) return;
            
            const user = getCurrentUser();
            if (user.isAuthenticated !== 'true' || !user.docId) {
                return; // Only check if logged in
            }

            isChecking.current = true;
            try {
                const res = await fetch(`/api/session-check?userId=${user.docId}`);
                
                // If the server crashed (e.g. 500 error), we ignore and don't logout
                if (!res.ok) {
                    isChecking.current = false;
                    return;
                }
                
                const data = await res.json();
                
                // 1. Session Invalid -> Logout
                if (data.valid === false) {
                    console.warn("Session invalidated by server. Logging out.");
                    logoutUser();
                    window.location.reload();
                    return;
                }

                // 2. New Version Available -> Refresh
                if (data.version && data.version !== APP_VERSION) {
                    console.log(`New version detected! Local: ${APP_VERSION}, Server: ${data.version}`);
                    
                    // Critical Operation Protection
                    const activeElement = document.activeElement;
                    const isTyping = activeElement && (
                        activeElement.tagName === 'INPUT' || 
                        activeElement.tagName === 'TEXTAREA' || 
                        (activeElement as HTMLElement).isContentEditable
                    );

                    if (isTyping) {
                        console.log("User is interacting with a form. Postponing refresh...");
                        // Reset lastCheckTime to force another check on the next interaction
                        lastCheckTime.current = 0; 
                    } else {
                        console.log("Refreshing page to load new version...");
                        window.location.reload();
                    }
                }
            } catch (e) {
                console.error("Failed to check session:", e);
            } finally {
                isChecking.current = false;
            }
        };

        // Throttled handler
        const handleInteraction = () => {
            const now = Date.now();
            if (now - lastCheckTime.current > CHECK_INTERVAL_MS) {
                lastCheckTime.current = now;
                performCheck();
            }
        };

        // Check immediately on mount
        handleInteraction();

        // Attach listeners for user activity
        window.addEventListener('click', handleInteraction, { passive: true });
        window.addEventListener('keydown', handleInteraction, { passive: true });
        window.addEventListener('touchstart', handleInteraction, { passive: true });
        window.addEventListener('scroll', handleInteraction, { passive: true });

        return () => {
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
            window.removeEventListener('scroll', handleInteraction);
        };
    }, []);

    return null; // Invisible component
}
