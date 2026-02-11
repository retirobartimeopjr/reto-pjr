import { useStore } from '@nanostores/react';
import { userStore } from '../store/userStore';

export default function RegistrationButton() {
    const user = useStore(userStore);

    // If authenticated, hide this button (return null)
    if (user.isAuthenticated === 'true' || user.isAuthenticated === true) {
        return null;
    }

    return (
        <div className="flex flex-col items-center gap-2 mt-8 z-20">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 text-[#f8b134] animate-bounce"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                ></path>
            </svg>
            <a
                href="https://forms.gle/HMvueg96JV3gqNmB6"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-gradient-to-r from-[#f8b134] to-[#bf8418] hover:from-[#fbd07e] hover:to-[#dca336] text-[#3d0000] font-bold text-xl rounded-full shadow-[0_0_20px_rgba(248,177,52,0.4)] hover:shadow-[0_0_30px_rgba(248,177,52,0.6)] transform hover:scale-105 transition-all duration-300 animate-bounce cursor-pointer flex items-center gap-3"
            >
                <span>¡Inscríbete AQUÍ al IV Retiro!</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                    ></path>
                </svg>
            </a>
        </div>
    );
}
