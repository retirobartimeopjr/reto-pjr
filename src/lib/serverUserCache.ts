
import { db } from '../services/firebase'; // Ensure this points to Admin SDK

// Define the User Data Shape
export interface CachedUser {
    docId: string;
    phone: string;
    username: string;
    ticketsFixed: string;
    payedTickets: number;
    score: number;
    parroquiasVistitadas: string;
    preguntasVistas: string;
    referencia: string;
    [key: string]: any; // Allow other fields
}

class UserCacheService {
    private users: CachedUser[] = [];
    private lastUpdated: number = 0;
    private REFRESH_INTERVAL_MS = 60 * 1000; // 60 Seconds
    private isFetching: boolean = false;

    constructor() {
        console.log("⚡ [CACHE] UserCacheService initialized.");
    }

    private async fetchUsersFromDB() {
        if (this.isFetching) return; // Prevent double fetch
        this.isFetching = true;

        console.log("🔥 [DB READ] Fetching ALL users from Firestore...");
        try {
            const usersRef = db.collection('user');
            const snapshot = await usersRef.get();

            if (snapshot.empty) {
                console.log("⚠️ [DB READ] No users found in collection.");
                this.users = [];
            } else {
                const fetchedUsers: CachedUser[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    fetchedUsers.push({
                        docId: doc.id,
                        phone: data.phone || '',
                        username: data.username || 'Usuario',
                        ticketsFixed: data['tickets-fixed'] || '',
                        payedTickets: Number(data['payedtickets']) || 0,
                        score: Number(data.score) || 0,
                        parroquiasVistitadas: data.parroquiasVistitadas || '',
                        preguntasVistas: data.preguntasvistas || '',
                        referencia: data.referencia || '',
                        ...data
                    });
                });
                this.users = fetchedUsers;
                console.log(`✅ [DB READ] Successfully loaded ${this.users.length} users into cache.`);
            }

            this.lastUpdated = Date.now();

        } catch (error) {
            console.error("❌ [DB ERROR] Failed to fetch users:", error);
        } finally {
            this.isFetching = false;
        }
    }

    public async getAllUsers(): Promise<CachedUser[]> {
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdated;

        if (this.users.length === 0 || timeSinceLastUpdate > this.REFRESH_INTERVAL_MS) {
            console.log(`⏳ [CACHE] Cache expired or empty (${Math.floor(timeSinceLastUpdate / 1000)}s old). Refreshing...`);
            await this.fetchUsersFromDB();
        } else {
            console.log(`📦 [CACHE] Handling request from memory (${Math.floor(timeSinceLastUpdate / 1000)}s old).`);
        }

        return this.users;
    }

    public async findUserByPhone(phone: string): Promise<CachedUser | undefined> {
        // Ensure cache is populated
        await this.getAllUsers();
        return this.users.find(u => u.phone === phone);
    }
}

// Singleton Instance
export const userCache = new UserCacheService();
