import { useState, useEffect } from 'react';

interface ContactInfo {
    target_person: string;
    coordinator_name: string;
    contact_method: string;
    created_at: string;
}

interface PaymentInfo {
    id: string;
    amount: number;
    payment_method: string;
    receipt_url: string;
    created_at: string;
}

interface RetiroTask {
    id: number;
    task_text: string;
    is_completed: boolean;
    created_at: string;
}

interface BartimeoData {
    id: number;
    documento_identidad: string;
    nombre_completo: string;
    edad: number;
    colegio: string;
    talla_camiseta: string;
    telefono_bartimeo: string;
    acudiente1_nombre: string;
    acudiente1_telefono: string;
    acudiente2_nombre: string;
    acudiente2_telefono: string;
    alergias: string;
    restriccion_alimentaria: string;
    condicion_medica: string;
    medicamentos: string;
    autoriza_imagen: boolean;
    coordi_contactado: string;
    acudiente1_contactado: boolean;
    acudiente2_contactado: boolean;
    comentarios: string;
    correo_enviado: boolean;
    valor_pagado: number;
    requiere_beca: boolean;
    es_candidato: boolean;
    participacion_confirmada: boolean;
    beca_otorgada: string;
    genero_override?: string | null;
    respuesta_recibida?: boolean;
    first_synced_at: string;
    last_synced_at: string;
    
    total_paid: number;
    latest_wp_contact: ContactInfo | null;
    latest_email_contact: ContactInfo | null;
    row_color?: string | null;
}

interface BartimeoDetails extends BartimeoData {
    fecha_nacimiento: string;
    direccion: string;
    retiros_previos: string;
    inscrito_antes: string;
    sacramentos: string[];
    conoce_servidor: string;
    acudiente1_parentesco: string;
    acudiente1_email: string;
    acudiente2_parentesco: string;
    acudiente2_email: string;
    doc_identidad_url: string;
    doc_identidad_file_id: string;
    eps: string;
    eps_certificado_url: string;
    eps_certificado_file_id: string;
    autoriza_datos: boolean;
}

function guessGender(name: string): 'Chico' | 'Chica' {
    const firstName = name.split(' ')[0] || '';
    const nameLower = firstName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const femaleNames = ['maria', 'ana', 'laura', 'sara', 'sarah', 'sofia', 'isabella', 'isabela', 'camila', 'valeria', 'valentina', 'luciana', 'mariana', 'daniela', 'angela', 'adriana', 'amelia', 'carmen', 'diana', 'emilia', 'gabriela', 'juana', 'juliana', 'natalia', 'paula', 'silvana', 'victoria', 'lizeth', 'carolina'];
    const maleNames = ['juan', 'jose', 'carlos', 'luis', 'santiago', 'sebastian', 'nicolas', 'daniel', 'david', 'felipe', 'andres', 'mateo', 'samuel', 'tomas', 'martin', 'simon', 'alejandro', 'camilo', 'cristian', 'diego', 'emilio', 'gabriel', 'jesus', 'manuel'];

    if (femaleNames.includes(nameLower) || nameLower.endsWith('a') || nameLower.endsWith('z')) {
        return 'Chica';
    } else if (maleNames.includes(nameLower) || nameLower.endsWith('o') || nameLower.endsWith('n') || nameLower.endsWith('s') || nameLower.endsWith('r') || nameLower.endsWith('l') || nameLower.endsWith('d') || nameLower.endsWith('e')) {
        return 'Chico';
    }
    return 'Chico'; // Default
}

function getGender(b: { nombre_completo: string, genero_override?: string | null }): 'Chico' | 'Chica' {
    if (b.genero_override === 'Chico' || b.genero_override === 'Chica') {
        return b.genero_override as 'Chico' | 'Chica';
    }
    return guessGender(b.nombre_completo);
}

export default function BartimeosManager({ username, password }: { username: string, password: string }) {
    const [bartimeos, setBartimeos] = useState<BartimeoData[]>([]);
    const [filteredBartimeos, setFilteredBartimeos] = useState<BartimeoData[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('date_asc');
    const [genderFilter, setGenderFilter] = useState('all');
    const [contactFilter, setContactFilter] = useState('all');
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [lastSync, setLastSync] = useState<any>(null);
    const [selectedBartimeo, setSelectedBartimeo] = useState<BartimeoDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    
    // Config state
    const [presupuestoMediasBecas, setPresupuestoMediasBecas] = useState<number>(0);
    const [editingPresupuesto, setEditingPresupuesto] = useState(false);
    const [newPresupuesto, setNewPresupuesto] = useState('0');
    const [savingPresupuesto, setSavingPresupuesto] = useState(false);
    
    const [paymentDeadline, setPaymentDeadline] = useState<string>('4 DE SEPTIEMBRE');
    const [editingPaymentDeadline, setEditingPaymentDeadline] = useState(false);
    const [newPaymentDeadline, setNewPaymentDeadline] = useState('4 DE SEPTIEMBRE');
    const [savingPaymentDeadline, setSavingPaymentDeadline] = useState(false);

    // Tasks state
    const [tasks, setTasks] = useState<RetiroTask[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [newTaskText, setNewTaskText] = useState('');
    const [addingTask, setAddingTask] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'info' | 'contactos' | 'pagos'>('info');

    // Contacts state
    const [contacts, setContacts] = useState<ContactInfo[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [newContactTarget, setNewContactTarget] = useState('Acudiente 1');
    const [newContactMethod, setNewContactMethod] = useState('WhatsApp');
    const [newContactCoordi, setNewContactCoordi] = useState('Aleja');
    const [addingContact, setAddingContact] = useState(false);

    // Payments state
    const [payments, setPayments] = useState<PaymentInfo[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [newPaymentAmount, setNewPaymentAmount] = useState('');
    const [newPaymentMethod, setNewPaymentMethod] = useState('Nequi');
    const [uploadReceiptFile, setUploadReceiptFile] = useState<File | null>(null);
    const [addingPayment, setAddingPayment] = useState(false);

    // Email Modal state
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(false);
    const [emailGender, setEmailGender] = useState<'chico' | 'chica'>('chica');
    const [emailTargetPerson, setEmailTargetPerson] = useState('Ambos');
    const [emailCoordinator, setEmailCoordinator] = useState('Aleja');
    
    // Edit state
    const [editingTracking, setEditingTracking] = useState(false);
    const [trackingState, setTrackingState] = useState({
        coordi: false,
        acudiente1: false,
        acudiente2: false,
        correo_enviado: false,
        comentarios: '',
        valor_pagado: 0,
        requiere_beca: false,
        es_candidato: false,
        participacion_confirmada: false,
        beca_otorgada: 'Ninguna',
        genero_override: ''
    });
    const [savingTracking, setSavingTracking] = useState(false);
    
    // WhatsApp Custom Modal State
    const [wpActionModal, setWpActionModal] = useState<{
        phone: string;
        acudienteName: string;
        bartimeo: BartimeoDetails;
    } | null>(null);

    const compressImage = (file: File, maxWidth = 1200, quality = 0.7): Promise<File> => {
        return new Promise((resolve) => {
            if (!file.type.startsWith('image/')) {
                resolve(file);
                return;
            }
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob(blob => {
                        if (!blob) {
                            resolve(file);
                            return;
                        }
                        const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                        const compressedFile = new File([blob], newFileName, {
                            type: 'image/webp',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    }, 'image/webp', quality);
                };
            };
        });
    };

    const fetchBartimeos = async (query = '') => {
        setLoading(true);
        setFeedback('');
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'list', searchQuery: query, sortBy })
            });
            const result = await res.json();
            if (res.ok) {
                setBartimeos(result.data);
                if (result.lastSync) setLastSync(result.lastSync);
            } else {
                setFeedback(`Error: ${result.error}`);
            }
        } catch (e) {
            setFeedback('Error de conexión al cargar bartimeos');
        } finally {
            setLoading(false);
        }
    };

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/appConfig');
            if (res.ok) {
                const config = await res.json();
                setPresupuestoMediasBecas(config.presupuesto_medias_becas || 0);
                if (config.payment_deadline_date) {
                    setPaymentDeadline(config.payment_deadline_date);
                    setNewPaymentDeadline(config.payment_deadline_date);
                }
            }
        } catch (e) {
            console.error("Error al cargar config", e);
        }
    };

    const fetchTasks = async () => {
        setLoadingTasks(true);
        try {
            const res = await fetch('/api/coordi/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'list' })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setTasks(data.tasks);
            }
        } catch (e) {
            console.error("Error fetching tasks", e);
        } finally {
            setLoadingTasks(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleSavePresupuesto = async () => {
        setSavingPresupuesto(true);
        try {
            const res = await fetch('/api/appConfig', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password,
                    presupuesto_medias_becas: parseInt(newPresupuesto) || 0
                })
            });
            if (res.ok) {
                setPresupuestoMediasBecas(parseInt(newPresupuesto) || 0);
                setEditingPresupuesto(false);
            } else {
                alert("Error al guardar presupuesto de becas");
            }
        } catch (e) {
            console.error("Error al guardar presupuesto", e);
        } finally {
            setSavingPresupuesto(false);
        }
    };

    const handleSavePaymentDeadline = async () => {
        setSavingPaymentDeadline(true);
        try {
            const res = await fetch('/api/appConfig', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    username, 
                    password, 
                    payment_deadline_date: newPaymentDeadline
                })
            });
            const result = await res.json();
            if (res.ok && result.success) {
                setPaymentDeadline(newPaymentDeadline);
                setEditingPaymentDeadline(false);
            } else {
                alert(result.error || 'Error al guardar');
            }
        } catch (e) {
            alert('Error de conexión');
        } finally {
            setSavingPaymentDeadline(false);
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskText.trim()) return;
        
        setAddingTask(true);
        try {
            const res = await fetch('/api/coordi/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'create', task_text: newTaskText.trim() })
            });
            const result = await res.json();
            if (res.ok && result.success) {
                setTasks([...tasks, result.task]);
                setNewTaskText('');
            } else {
                alert(result.error || 'Error creando tarea');
            }
        } catch (e) {
            console.error("Error creating task", e);
        } finally {
            setAddingTask(false);
        }
    };

    const handleToggleTask = async (taskId: number, currentStatus: boolean) => {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, is_completed: !currentStatus } : t));
        
        try {
            const res = await fetch('/api/coordi/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'toggle', task_id: taskId, is_completed: !currentStatus })
            });
            const result = await res.json();
            if (!res.ok || !result.success) {
                setTasks(tasks.map(t => t.id === taskId ? { ...t, is_completed: currentStatus } : t));
                alert(result.error || 'Error actualizando tarea');
            }
        } catch (e) {
            console.error("Error toggling task", e);
            setTasks(tasks.map(t => t.id === taskId ? { ...t, is_completed: currentStatus } : t));
        }
    };

    const handleDeleteTask = async (taskId: number) => {
        if (!confirm('¿Seguro que deseas eliminar esta tarea?')) return;
        
        const previousTasks = [...tasks];
        setTasks(tasks.filter(t => t.id !== taskId));
        
        try {
            const res = await fetch('/api/coordi/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'delete', task_id: taskId })
            });
            const result = await res.json();
            if (!res.ok || !result.success) {
                setTasks(previousTasks);
                alert(result.error || 'Error eliminando tarea');
            }
        } catch (e) {
            console.error("Error deleting task", e);
            setTasks(previousTasks);
        }
    };

    useEffect(() => {
        let result = bartimeos;
            
        if (genderFilter !== 'all') {
            result = result.filter(b => {
                const gender = getGender(b);
                return genderFilter === 'chico' ? gender === 'Chico' : gender === 'Chica';
            });
        }
        
        if (contactFilter !== 'all') {
            result = result.filter(b => {
                const isContacted = !!(
                    b.latest_wp_contact || 
                    b.latest_email_contact || 
                    (b.coordi_contactado && b.coordi_contactado !== 'false' && b.coordi_contactado !== 'true') ||
                    b.correo_enviado
                );
                return contactFilter === 'contacted' ? isContacted : !isContacted;
            });
        }
        
        setFilteredBartimeos(result);
    }, [bartimeos, genderFilter, contactFilter]);

    const handleSync = async () => {
        setSyncing(true);
        setFeedback('');
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'sync' })
            });
            const data = await res.json();
            if (res.ok) {
                setFeedback(`✅ Sincronización exitosa: ${data.rows_read} leídos · ${data.inserted} nuevos · ${data.updated} actualizados · ${data.unchanged} sin cambios.`);
                fetchBartimeos(searchQuery);
            } else {
                setFeedback(`❌ Error de Sincronización: ${data.error}`);
            }
        } catch (e: any) {
            setFeedback(`❌ Error de conexión: ${e.message}`);
        } finally {
            setSyncing(false);
        }
    };

    const handleViewDetails = async (id: number) => {
        setLoadingDetails(true);
        setFeedback('');
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'details', id })
            });
            const data = await res.json();
            if (res.ok) {
                // Ensure data has the totals by finding it in the main list
                const mainListData = bartimeos.find(b => b.id === id);
                setSelectedBartimeo({
                    ...data,
                    total_paid: mainListData?.total_paid || 0,
                    latest_wp_contact: mainListData?.latest_wp_contact || null,
                    latest_email_contact: mainListData?.latest_email_contact || null
                });
                setActiveTab('info');
                setTrackingState({
                    coordi: !!data.coordi_contactado,
                    acudiente1: !!data.acudiente1_contactado,
                    acudiente2: !!data.acudiente2_contactado,
                    correo_enviado: !!data.correo_enviado,
                    comentarios: data.comentarios || '',
                    valor_pagado: data.valor_pagado || 0,
                    requiere_beca: !!data.requiere_beca,
                    es_candidato: !!data.es_candidato,
                    participacion_confirmada: !!data.participacion_confirmada,
                    beca_otorgada: data.beca_otorgada || 'Ninguna',
                    genero_override: data.genero_override || ''
                });
                setEditingTracking(false);
            } else {
                setFeedback(`Error: ${data.error}`);
            }
        } catch (e) {
            setFeedback('Error al cargar detalles del inscrito');
        } finally {
            setLoadingDetails(false);
        }
    };

    const fetchContacts = async (id: number) => {
        setLoadingContacts(true);
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'get_contacts', id })
            });
            const data = await res.json();
            if (res.ok) setContacts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingContacts(false);
        }
    };

    const fetchPayments = async (id: number) => {
        setLoadingPayments(true);
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, action: 'get_payments', id })
            });
            const data = await res.json();
            if (res.ok) setPayments(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingPayments(false);
        }
    };

    useEffect(() => {
        if (selectedBartimeo) {
            if (activeTab === 'contactos') fetchContacts(selectedBartimeo.id);
            if (activeTab === 'pagos') fetchPayments(selectedBartimeo.id);
        }
    }, [activeTab, selectedBartimeo?.id]);

    const handleSaveTracking = async () => {
        if (!selectedBartimeo) return;
        setSavingTracking(true);
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username, password, action: 'update_tracking',
                    id: selectedBartimeo.id,
                    coordi_contactado: trackingState.coordi,
                    acudiente1_contactado: trackingState.acudiente1,
                    acudiente2_contactado: trackingState.acudiente2,
                    correo_enviado: trackingState.correo_enviado,
                    comentarios: trackingState.comentarios,
                    valor_pagado: trackingState.valor_pagado,
                    requiere_beca: trackingState.requiere_beca,
                    es_candidato: trackingState.es_candidato,
                    participacion_confirmada: trackingState.participacion_confirmada,
                    beca_otorgada: trackingState.beca_otorgada,
                    genero_override: trackingState.genero_override || null
                })
            });
            if (res.ok) {
                const updated = {
                    ...selectedBartimeo,
                    coordi_contactado: trackingState.coordi ? 'true' : '',
                    acudiente1_contactado: trackingState.acudiente1,
                    acudiente2_contactado: trackingState.acudiente2,
                    correo_enviado: trackingState.correo_enviado,
                    comentarios: trackingState.comentarios,
                    valor_pagado: trackingState.valor_pagado,
                    requiere_beca: trackingState.requiere_beca,
                    es_candidato: trackingState.es_candidato,
                    participacion_confirmada: trackingState.participacion_confirmada,
                    beca_otorgada: trackingState.beca_otorgada,
                    genero_override: trackingState.genero_override || null
                };
                setSelectedBartimeo(updated);
                setBartimeos(bartimeos.map(b => b.id === selectedBartimeo.id ? updated : b));
                setEditingTracking(false);
            } else {
                alert('Error al guardar trazabilidad');
            }
        } catch (e) {
            alert('Error de conexión');
        } finally {
            setSavingTracking(false);
        }
    };

    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBartimeo) return;
        setAddingContact(true);
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username, password, action: 'add_contact',
                    id: selectedBartimeo.id,
                    targetPerson: newContactTarget,
                    coordinatorName: newContactCoordi,
                    contactMethod: newContactMethod
                })
            });
            if (res.ok) {
                await fetchContacts(selectedBartimeo.id);
                fetchBartimeos(searchQuery); // Update latest contact in list
            } else {
                alert('Error al guardar contacto');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setAddingContact(false);
        }
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBartimeo || !uploadReceiptFile || !newPaymentAmount) return;
        setAddingPayment(true);
        try {
            const compressedFile = await compressImage(uploadReceiptFile);
            
            const presignedRes = await fetch('/api/s3/presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: compressedFile.name,
                    fileType: compressedFile.type,
                    folder: 'tickets',
                    username: selectedBartimeo.username || 'admin_upload'
                }),
            });
            
            if (!presignedRes.ok) throw new Error("Fallo al obtener url de subida");
            const { uploadUrl, publicUrl, success } = await presignedRes.json();
            if (!success || !uploadUrl) throw new Error("Fallo al obtener url de subida");
            
            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                body: compressedFile,
                headers: { 'Content-Type': compressedFile.type },
            });
            
            if (!uploadRes.ok) throw new Error("Fallo al subir archivo a AWS");

            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username, password, action: 'add_payment',
                    id: selectedBartimeo.id,
                    amount: parseInt(newPaymentAmount),
                    paymentMethod: newPaymentMethod,
                    receiptUrl: publicUrl
                })
            });
            if (res.ok) {
                await fetchPayments(selectedBartimeo.id);
                fetchBartimeos(searchQuery); // Update total paid in list
                setNewPaymentAmount('');
                setUploadReceiptFile(null);
                setNewPaymentAmount('');
                setUploadReceiptFile(null);
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (e: any) {
            alert(`Error: ${e.message}`);
        } finally {
            setAddingPayment(false);
        }
    };

    const handleViewReceipt = async (url: string) => {
        try {
            const res = await fetch('/api/s3/presignGet', {
                method: 'POST',
                body: JSON.stringify({ fileUrl: url }),
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (res.ok && data.url) {
                window.open(data.url, '_blank');
            } else {
                window.open(url, '_blank');
            }
        } catch (e) {
            window.open(url, '_blank');
        }
    };

    const handleCancelAttendance = async () => {
        if (!selectedBartimeo) return;
        
        const confirm1 = window.confirm('⚠️ ¿Estás totalmente seguro de cancelar la asistencia de este participante? Esta acción lo marcará en rojo en el Excel.');
        if (!confirm1) return;
        
        const confirm2 = window.confirm('Esta acción es irreversible y requiere doble confirmación. ¿Continuar con la cancelación de asistencia?');
        if (!confirm2) return;

        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: 'cancel_attendance', 
                    id: selectedBartimeo.id 
                })
            });

            if (res.ok) {
                const updated = { ...selectedBartimeo, es_candidato: false };
                setSelectedBartimeo(updated);
                setBartimeos(bartimeos.map(b => b.id === selectedBartimeo.id ? updated : b));
                alert('Asistencia cancelada exitosamente y fila marcada en rojo en Sheets.');
            } else {
                alert('Error al cancelar la asistencia.');
            }
        } catch (e) {
            console.error("Error cancelling attendance", e);
            alert('Error de conexión al cancelar asistencia.');
        }
    };

    const handleSendEmail = async () => {
        if (!selectedBartimeo) return;
        setSendingEmail(true);
        try {
            const res = await fetch('/api/coordi/bartimeo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username, password, action: 'send_acceptance_email',
                    id: selectedBartimeo.id,
                    gender: emailGender,
                    targetPerson: emailTargetPerson,
                    coordinatorName: emailCoordinator
                })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Correo enviado exitosamente a: ${data.to.join(', ')}`);
                
                const updated = { ...selectedBartimeo, correo_enviado: true };
                setSelectedBartimeo(updated);
                
                fetchBartimeos(searchQuery); // updates contacts and status
                if (activeTab === 'contactos') fetchContacts(selectedBartimeo.id);
                
                setEmailModalOpen(false);
            } else {
                alert(`Error al enviar correo: ${data.error}`);
            }
        } catch (e) {
            alert('Error de conexión al enviar correo');
        } finally {
            setSendingEmail(false);
        }
    };

    useEffect(() => {
        fetchConfig();
        fetchBartimeos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchBartimeos(searchQuery);
    };

    const requiresAttention = (text: string) => {
        if (!text) return false;
        const norm = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return !["", "no", "ninguna", "ninguno", "n/a", "na", "-"].includes(norm);
    };

    const getWpLink = (bartimeo: BartimeoDetails, phone: string, acudienteName: string) => {
        if (!phone) return '#';
        const firstName = bartimeo.nombre_completo.split(' ')[0] || 'tu hijo/a';
        let aceptado = getGender(bartimeo) === 'Chica' ? 'aceptada' : 'aceptado';
        const acudFirstName = (acudienteName || 'Acudiente').split(' ')[0];
        const msg = `🎉 ¡Hola ${acudFirstName}! Nos alegra muchísimo contarte que ${firstName} ha sido ${aceptado} para participar en el *V Retiro Bartimeo* 🤍🙏. Te contamos que *ya hemos enviado a tu correo electrónico toda la información correspondiente al retiro*, incluyendo documentos pendientes, valor de la inversión, medios de pago y fechas importantes. Te agradecemos revisarlo con atención y quedamos muy atentos a cualquier inquietud. ¡Estamos muy felices de poder vivir esta experiencia junto a ${firstName}! 🥰✨`;
        const cleanPhone = phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.startsWith('57') ? cleanPhone : (cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone);
        return `https://api.whatsapp.com/send/?phone=${finalPhone}&text=${encodeURIComponent(msg)}&type=phone_number&app_absent=0`;
    };

    const handleWpClick = (e: React.MouseEvent, bartimeo: BartimeoDetails, phone: string, acudienteName: string) => {
        e.preventDefault();
        if (!phone) return;
        setWpActionModal({ phone, acudienteName, bartimeo });
    };

    const handleToggleRespuesta = async (e: React.MouseEvent, id: number, currentStatus: boolean) => {
        e.stopPropagation();
        
        // Optimistic update
        setBartimeos(prev => prev.map(b => b.id === id ? { ...b, respuesta_recibida: !currentStatus } : b));
        setFilteredBartimeos(prev => prev.map(b => b.id === id ? { ...b, respuesta_recibida: !currentStatus } : b));
        
        try {
            const res = await fetch('/api/coordi/bartimeo?action=toggle_respuesta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle_respuesta', username, password, id, status: !currentStatus })
            });
            if (!res.ok) throw new Error('Error al guardar en el servidor');
        } catch (error) {
            console.error('Error toggling respuesta:', error);
            // Revert on error
            setBartimeos(prev => prev.map(b => b.id === id ? { ...b, respuesta_recibida: currentStatus } : b));
            setFilteredBartimeos(prev => prev.map(b => b.id === id ? { ...b, respuesta_recibida: currentStatus } : b));
        }
    };

    // Calculate Summary Metrics
    const candidatos = bartimeos.filter(b => b.es_candidato);
    const totalCandidatos = candidatos.length;
    
    const confirmados = bartimeos.filter(b => b.participacion_confirmada);
    const totalConfirmados = confirmados.length;
    
    const totalEsperado = confirmados.reduce((acc, b) => {
        if (b.beca_otorgada === 'Beca Completa') return acc;
        if (b.beca_otorgada === 'Media Beca') return acc + 250000;
        return acc + 500000;
    }, 0);
    
    const totalRecaudado = bartimeos.reduce((acc, b) => acc + Number(b.total_paid || 0), 0);
    const progreso = totalEsperado > 0 ? Math.min(100, Math.round((totalRecaudado / totalEsperado) * 100)) : 0;
    const personasPagado = bartimeos.filter(b => Number(b.total_paid || 0) > 0).length;

    const mediasBecasUsadas = bartimeos.reduce((acc, b) => {
        if (b.beca_otorgada === 'Media Beca') return acc + 1;
        if (b.beca_otorgada === 'Beca Completa') return acc + 2;
        return acc;
    }, 0);

    return (
        <div className="space-y-6 relative">
            <div className="bg-[#161616] rounded-3xl p-6 md:p-8 border border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Coordinación Bartimeos — V Retiro</h2>
                    <p className="text-zinc-400 text-sm mt-1">
                        Total de inscritos: <span className="text-brand font-bold">{bartimeos.length}</span>
                        {lastSync && ` • Última actualización: ${new Date(lastSync.finished_at).toLocaleString()}`}
                    </p>
                </div>
                <button 
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-brand text-black px-6 py-3 rounded-xl font-bold hover:bg-white transition-colors disabled:opacity-50 text-sm flex items-center gap-2"
                >
                    {syncing ? (
                        <span className="animate-spin inline-block">⏳</span>
                    ) : '🔄'}
                    Actualizar desde formulario
                </button>
            </div>
            
            {/* Financial Summary */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Total Recaudado</div>
                    <div className="text-2xl font-mono font-bold text-green-400">${(totalRecaudado).toLocaleString('es-CO')}</div>
                    <div className="text-zinc-500 text-xs mt-2 flex items-center gap-2">
                        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-green-400 h-full" style={{ width: `${progreso}%` }}></div>
                        </div>
                        <span>{progreso}%</span>
                    </div>
                </div>
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Total Esperado</div>
                    <div className="text-2xl font-mono font-bold text-white">${(totalEsperado).toLocaleString('es-CO')}</div>
                    <div className="text-zinc-500 text-xs mt-2">Basado en {totalConfirmados} confirmados</div>
                </div>
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 relative group">
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Presupuesto Becas</div>
                    {editingPresupuesto ? (
                        <div className="flex gap-2 mt-1">
                            <input 
                                type="number" 
                                value={newPresupuesto} 
                                onChange={e => setNewPresupuesto(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded px-2 text-white"
                            />
                            <button onClick={handleSavePresupuesto} disabled={savingPresupuesto} className="bg-brand text-black px-2 rounded text-xs font-bold">
                                {savingPresupuesto ? '...' : 'OK'}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="text-2xl font-bold text-white">
                                {mediasBecasUsadas} <span className="text-lg text-zinc-600">/ {presupuestoMediasBecas}</span>
                            </div>
                            <div className="text-zinc-500 text-xs mt-2">Medias Becas (1 Completa = 2)</div>
                            <button 
                                onClick={() => { setNewPresupuesto(presupuestoMediasBecas.toString()); setEditingPresupuesto(true); }}
                                className="absolute top-4 right-4 text-zinc-600 hover:text-white hidden group-hover:block"
                            >
                                ✏️
                            </button>
                        </>
                    )}
                </div>
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Pagos / Confirmados</div>
                    <div className="text-2xl font-bold text-white">{personasPagado} <span className="text-lg text-zinc-600">/ {totalConfirmados}</span></div>
                    <div className="text-zinc-500 text-xs mt-2">Personas con pagos registrados</div>
                </div>
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Total Candidatos</div>
                    <div className="text-2xl font-bold text-brand">{totalCandidatos}</div>
                    <div className="text-zinc-500 text-xs mt-2">Aprobados para participar</div>
                </div>
            </div>

            {/* Admin Config Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 relative group">
                    <div className="text-zinc-500 text-xs font-bold uppercase tracking-wider mb-1">Fecha Límite Pago (Correos)</div>
                    {editingPaymentDeadline ? (
                        <div className="flex gap-2 mt-1">
                            <input 
                                type="text" 
                                value={newPaymentDeadline} 
                                onChange={e => setNewPaymentDeadline(e.target.value)}
                                className="w-full bg-black border border-white/10 rounded px-2 py-1 text-white text-sm"
                                placeholder="Ej: 4 DE SEPTIEMBRE"
                            />
                            <button onClick={handleSavePaymentDeadline} disabled={savingPaymentDeadline} className="bg-brand text-black px-3 rounded text-xs font-bold">
                                {savingPaymentDeadline ? '...' : 'OK'}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="text-lg font-bold text-white mt-1">
                                {paymentDeadline}
                            </div>
                            <div className="text-zinc-500 text-xs mt-2">Texto enviado en el correo de aceptación</div>
                            <button 
                                onClick={() => { setNewPaymentDeadline(paymentDeadline); setEditingPaymentDeadline(true); }}
                                className="absolute top-4 right-4 text-zinc-600 hover:text-white hidden group-hover:block"
                            >
                                ✏️
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Task Board Section */}
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 shadow-lg">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Tablero de Tareas - V Retiro
                </h3>
                
                {loadingTasks ? (
                    <div className="text-center text-zinc-500 py-4 text-sm animate-pulse">Cargando tareas...</div>
                ) : (
                    <div className="space-y-2">
                        {tasks.map(task => (
                            <div key={task.id} className="flex items-center justify-between group p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-white/5">
                                <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => handleToggleTask(task.id, task.is_completed)}>
                                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${task.is_completed ? 'bg-brand border-brand' : 'border-zinc-500 bg-transparent'}`}>
                                        {task.is_completed && <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" fillRule="evenodd"></path></svg>}
                                    </div>
                                    <span className={`text-sm select-none transition-colors ${task.is_completed ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                                        {task.task_text}
                                    </span>
                                </div>
                                <button 
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="opacity-0 group-hover:opacity-100 p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                    title="Eliminar tarea"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            </div>
                        ))}
                        
                        {tasks.length === 0 && (
                            <div className="text-center text-zinc-500 py-6 text-sm italic">
                                No hay tareas pendientes. ¡Buen trabajo!
                            </div>
                        )}
                        
                        <form onSubmit={handleAddTask} className="mt-4 pt-4 border-t border-white/5 flex gap-2">
                            <input 
                                type="text"
                                value={newTaskText}
                                onChange={e => setNewTaskText(e.target.value)}
                                placeholder="Escribe una nueva tarea y presiona Enter..."
                                className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder-zinc-600 focus:border-brand focus:outline-none transition-colors"
                                disabled={addingTask}
                            />
                            <button 
                                type="submit" 
                                disabled={!newTaskText.trim() || addingTask}
                                className="bg-brand text-black font-bold px-4 rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand/90 transition-colors"
                            >
                                {addingTask ? '...' : 'Agregar'}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            {feedback && (
                <div className={`p-4 border rounded-xl text-sm font-bold ${
                    feedback.includes('❌') ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-green-500/10 border-green-500/30 text-green-400'
                }`}>
                    {feedback}
                </div>
            )}

            <div className="bg-[#161616] rounded-3xl p-6 border border-white/5 space-y-6">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nombre, cédula o colegio..."
                        className="flex-grow bg-[#0a0a0a] border border-white/5 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand/50"
                    />
                    <select
                        value={genderFilter}
                        onChange={(e) => setGenderFilter(e.target.value)}
                        className="bg-[#1a1a1a] border border-white/10 text-white px-4 py-3 md:py-2 rounded-xl focus:outline-none focus:border-brand text-sm"
                    >
                        <option value="all">Ambos (Chico y Chica)</option>
                        <option value="chico">Solo Chicos</option>
                        <option value="chica">Solo Chicas</option>
                    </select>
                    <select
                        value={contactFilter}
                        onChange={(e) => setContactFilter(e.target.value)}
                        className="bg-[#1a1a1a] border border-white/10 text-white px-4 py-3 md:py-2 rounded-xl focus:outline-none focus:border-brand text-sm"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="contacted">Contactados</option>
                        <option value="not_contacted">No Contactados</option>
                    </select>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand/50"
                    >
                        <option value="date_asc">Orden de Inscripción</option>
                        <option value="date_desc">Más Recientes</option>
                        <option value="name">Alfabético</option>
                    </select>
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-white/10 border border-white/20 text-white px-6 py-3 md:py-2 rounded-xl font-bold hover:bg-white/20 transition disabled:opacity-50 text-sm"
                    >
                        {loading ? '...' : 'Buscar'}
                    </button>
                </form>

                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-380px)] rounded-xl border border-white/5 bg-[#0a0a0a] relative">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="sticky top-0 bg-[#0a0a0a] z-20 text-zinc-500 text-xs uppercase tracking-wider shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                                <th className="p-4 font-bold">Participante</th>
                                <th className="p-4 font-bold">Sexo / Edad</th>
                                <th className="p-4 font-bold">Salud / Talla</th>
                                <th className="p-4 font-bold text-center">Trazabilidad (Contactos)</th>
                                <th className="p-4 font-bold text-right pr-8">Pagos</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-white/5">
                            {filteredBartimeos.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-zinc-500 italic">
                                        No hay inscritos que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            ) : (
                                filteredBartimeos.map((b) => {
                                    let rowColor = 'hover:bg-white/5';
                                    let tdBg = 'bg-[#0a0a0a]';
                                    let tdHover = 'group-hover:bg-[#121212]';

                                    if (b.correo_enviado) {
                                        if (Number(b.total_paid) >= 500000) {
                                            rowColor = 'bg-green-900/10 hover:bg-green-900/20';
                                            tdBg = 'bg-[#0b1710]';
                                            tdHover = 'group-hover:bg-[#0e2115]';
                                        } else {
                                            rowColor = 'bg-blue-900/10 hover:bg-blue-900/20';
                                            tdBg = 'bg-[#0b1420]';
                                            tdHover = 'group-hover:bg-[#0f1d30]';
                                        }
                                    }
                                    
                                    const gender = getGender(b);
                                    
                                    return (
                                        <tr 
                                            key={b.id} 
                                            onDoubleClick={() => !loadingDetails && handleViewDetails(b.id)}
                                            className={`transition group ${rowColor} cursor-pointer hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] relative`}
                                            title="Doble clic para ver ficha"
                                        >
                                            <td className="p-4 relative">
                                            {b.row_color && (
                                                <div 
                                                    className="absolute left-0 top-0 bottom-0 w-1.5"
                                                    style={{ backgroundColor: b.row_color }}
                                                    title="Color en Google Sheets"
                                                />
                                            )}
                                            <div className="font-bold text-white flex items-center gap-2">
                                                {b.nombre_completo}
                                                {!b.autoriza_imagen && (
                                                    <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full border border-red-500/30" title="No autoriza uso de imagen">📸 No Foto</span>
                                                )}
                                                {b.es_candidato && <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full border border-green-500/30">Candidato</span>}
                                            </div>
                                            <div className="text-xs text-zinc-500 mt-1 truncate max-w-[250px]">
                                                🪪 {b.documento_identidad} | 📱 {b.telefono_bartimeo} | {b.colegio}
                                            </div>
                                        </td>
                                        <td className="p-4 text-zinc-300">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${gender === 'Chico' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}`}>{gender}</span>
                                                <span className="text-zinc-400 text-xs">{b.edad} años</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-center font-bold text-white mb-1">
                                                👕 {b.talla_camiseta || '-'}
                                            </div>
                                            <div className="flex justify-center gap-1 text-base">
                                                {requiresAttention(b.alergias) && <span title={`Alergias: ${b.alergias}`}>🔴</span>}
                                                {requiresAttention(b.restriccion_alimentaria) && <span title={`Dieta: ${b.restriccion_alimentaria}`}>🍽️</span>}
                                                {requiresAttention(b.condicion_medica) && <span title={`Médica: ${b.condicion_medica}`}>🏥</span>}
                                                {requiresAttention(b.medicamentos) && <span title={`Medicamentos: ${b.medicamentos}`}>💊</span>}
                                                {!requiresAttention(b.alergias) && !requiresAttention(b.restriccion_alimentaria) && !requiresAttention(b.condicion_medica) && !requiresAttention(b.medicamentos) && <span className="text-zinc-600 text-xs">OK</span>}
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 text-center">📱</span>
                                                    {b.latest_wp_contact ? (
                                                        <span className="text-green-400 flex items-center gap-1">
                                                            ✅ <span className="text-zinc-300">{b.latest_wp_contact.target_person} —</span> {b.latest_wp_contact.coordinator_name}
                                                        </span>
                                                    ) : (b.coordi_contactado && b.coordi_contactado !== 'false' && b.coordi_contactado !== 'true') ? (
                                                        <span className="text-green-400 flex items-center gap-1">
                                                            ✅ <span className="text-zinc-300">Coordi —</span> {b.coordi_contactado}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-600">No contactado</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="w-5 text-center">✉️</span>
                                                    {b.latest_email_contact ? (
                                                        <span className="text-blue-400 flex items-center gap-1">
                                                            ✅ <span className="text-zinc-300">{b.latest_email_contact.target_person} —</span> {b.latest_email_contact.coordinator_name}
                                                        </span>
                                                    ) : b.correo_enviado ? (
                                                        <span className="text-blue-400 flex items-center gap-1">
                                                            ✅ <span className="text-zinc-300">Correo —</span> Enviado
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-600">No contactado</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 pt-1 border-t border-white/5 mt-1">
                                                    <span className="w-5 text-center">💬</span>
                                                    <button 
                                                        onClick={(e) => handleToggleRespuesta(e, b.id, !!b.respuesta_recibida)}
                                                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition ${
                                                            b.respuesta_recibida 
                                                            ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                                                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                                                        }`}
                                                    >
                                                        {b.respuesta_recibida ? '✓ Respondió' : 'Sin respuesta'}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right pr-8">
                                            <div className={`font-mono font-bold ${Number(b.total_paid) >= 500000 ? 'text-green-400' : (Number(b.total_paid) > 0 ? 'text-yellow-400' : 'text-zinc-600')}`}>
                                                ${(Number(b.total_paid) || 0).toLocaleString('es-CO')}
                                            </div>
                                            {b.requiere_beca && <div className="text-[10px] text-yellow-500 uppercase font-bold mt-1">Beca</div>}
                                        </td>
                                    </tr>
                                );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* User Details Modal */}
            {selectedBartimeo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-[#161616] border border-white/10 rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#0a0a0a]">
                            <div>
                                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                                    {selectedBartimeo.nombre_completo}
                                    {!selectedBartimeo.autoriza_imagen && (
                                        <span className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full border border-red-500/30 uppercase tracking-wider font-bold">Sin Fotos</span>
                                    )}
                                </h3>
                                <p className="text-sm text-zinc-400 mt-1 flex items-center gap-2">
                                    🪪 {selectedBartimeo.documento_identidad} • 📱 {selectedBartimeo.telefono_bartimeo} • 🎂 {selectedBartimeo.fecha_nacimiento} ({selectedBartimeo.edad} años)
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${getGender(selectedBartimeo) === 'Chico' ? 'bg-blue-500/20 text-blue-400' : 'bg-pink-500/20 text-pink-400'}`}>
                                        {getGender(selectedBartimeo)}
                                    </span>
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                {selectedBartimeo.es_candidato && (
                                    <button
                                        onClick={handleCancelAttendance}
                                        className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/40 transition"
                                    >
                                        Cancelar Asistencia
                                    </button>
                                )}
                                <button 
                                    onClick={() => { setSelectedBartimeo(null); setEmailModalOpen(false); }}
                                    className="text-zinc-500 hover:text-white transition p-2 bg-white/5 rounded-full"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        
                        {/* Tabs */}
                        <div className="flex border-b border-white/5 bg-[#0a0a0a] px-6">
                            <button 
                                onClick={() => setActiveTab('info')}
                                className={`px-6 py-4 text-sm font-bold border-b-2 transition ${activeTab === 'info' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-white'}`}
                            >
                                📋 Información General
                            </button>
                            <button 
                                onClick={() => setActiveTab('pagos')}
                                className={`px-6 py-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${activeTab === 'pagos' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-white'}`}
                            >
                                💰 Pagos <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs">{payments.length}</span>
                            </button>
                            <button 
                                onClick={() => setActiveTab('contactos')}
                                className={`px-6 py-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${activeTab === 'contactos' ? 'border-brand text-brand' : 'border-transparent text-zinc-500 hover:text-white'}`}
                            >
                                📞 Contactos <span className="bg-white/10 px-2 py-0.5 rounded-full text-xs">{contacts.length}</span>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 180px)' }}>
                            {activeTab === 'info' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Datos Bartimeo */}
                                    <div className="space-y-4">
                                        <h4 className="text-brand font-bold text-sm uppercase tracking-widest border-b border-white/10 pb-2">Datos del Bartimeo</h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <div className="text-zinc-500">Colegio</div>
                                                <div className="text-white font-medium">{selectedBartimeo.colegio || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-500">Dirección</div>
                                                <div className="text-white font-medium">{selectedBartimeo.direccion || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-500">Talla de Camiseta</div>
                                                <div className="text-white font-medium font-bold">{selectedBartimeo.talla_camiseta || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-500">Retiros Previos</div>
                                                <div className="text-white font-medium">{selectedBartimeo.retiros_previos || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-500">Inscrito Antes</div>
                                                <div className="text-white font-medium">{selectedBartimeo.inscrito_antes || '-'}</div>
                                            </div>
                                            <div>
                                                <div className="text-zinc-500">Conoce Servidor</div>
                                                <div className="text-white font-medium">{selectedBartimeo.conoce_servidor || '-'}</div>
                                            </div>
                                            <div className="col-span-2">
                                                <div className="text-zinc-500">Sacramentos</div>
                                                <div className="text-white font-medium">{selectedBartimeo.sacramentos && selectedBartimeo.sacramentos.length > 0 ? selectedBartimeo.sacramentos.join(', ') : '-'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Salud */}
                                    <div className="space-y-4">
                                        <h4 className="text-brand font-bold text-sm uppercase tracking-widest border-b border-white/10 pb-2">Información de Salud</h4>
                                        <div className="space-y-3 text-sm">
                                            <div className="p-3 rounded-lg border border-white/5 bg-[#0a0a0a]">
                                                <div className="text-zinc-500">EPS o Prepagada</div>
                                                <div className="text-white font-medium">{selectedBartimeo.eps || '-'}</div>
                                            </div>
                                            <div className={`p-3 rounded-lg border ${requiresAttention(selectedBartimeo.alergias) ? 'bg-red-500/10 border-red-500/30' : 'border-white/5 bg-[#0a0a0a]'}`}>
                                                <div className={`${requiresAttention(selectedBartimeo.alergias) ? 'text-red-400 font-bold' : 'text-zinc-500'}`}>Alergias</div>
                                                <div className="text-white">{selectedBartimeo.alergias || '-'}</div>
                                            </div>
                                            <div className={`p-3 rounded-lg border ${requiresAttention(selectedBartimeo.restriccion_alimentaria) ? 'bg-yellow-500/10 border-yellow-500/30' : 'border-white/5 bg-[#0a0a0a]'}`}>
                                                <div className={`${requiresAttention(selectedBartimeo.restriccion_alimentaria) ? 'text-yellow-400 font-bold' : 'text-zinc-500'}`}>Restricción Alimentaria</div>
                                                <div className="text-white">{selectedBartimeo.restriccion_alimentaria || '-'}</div>
                                            </div>
                                            <div className={`p-3 rounded-lg border ${requiresAttention(selectedBartimeo.condicion_medica) ? 'bg-orange-500/10 border-orange-500/30' : 'border-white/5 bg-[#0a0a0a]'}`}>
                                                <div className={`${requiresAttention(selectedBartimeo.condicion_medica) ? 'text-orange-400 font-bold' : 'text-zinc-500'}`}>Condición Médica/Psicológica</div>
                                                <div className="text-white">{selectedBartimeo.condicion_medica || '-'}</div>
                                            </div>
                                            <div className={`p-3 rounded-lg border ${requiresAttention(selectedBartimeo.medicamentos) ? 'bg-blue-500/10 border-blue-500/30' : 'border-white/5 bg-[#0a0a0a]'}`}>
                                                <div className={`${requiresAttention(selectedBartimeo.medicamentos) ? 'text-blue-400 font-bold' : 'text-zinc-500'}`}>Medicamentos</div>
                                                <div className="text-white">{selectedBartimeo.medicamentos || '-'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Acudientes */}
                                    <div className="space-y-4">
                                        <h4 className="text-brand font-bold text-sm uppercase tracking-widest border-b border-white/10 pb-2">Acudientes</h4>
                                        <div className="bg-[#0a0a0a] p-4 rounded-xl border border-white/5 space-y-2 text-sm">
                                            <div className="font-bold text-white mb-2">Acudiente 1</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="text-zinc-500">Nombre</div><div className="text-white">{selectedBartimeo.acudiente1_nombre || '-'}</div>
                                                <div className="text-zinc-500">Parentesco</div><div className="text-white">{selectedBartimeo.acudiente1_parentesco || '-'}</div>
                                                <div className="text-zinc-500">Teléfono</div>
                                                <div className="text-white font-bold flex items-center gap-2">
                                                    {selectedBartimeo.acudiente1_telefono || '-'}
                                                    {selectedBartimeo.acudiente1_telefono && (
                                                        <button onClick={(e) => handleWpClick(e, selectedBartimeo, selectedBartimeo.acudiente1_telefono, selectedBartimeo.acudiente1_nombre)} title="Hablar por WhatsApp" className="text-green-400 hover:text-green-300 transition text-lg bg-green-500/10 rounded-full px-2 py-0.5" style={{ textDecoration: 'none' }}>
                                                            <span role="img" aria-label="WhatsApp">💬</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="text-zinc-500">Email</div><div className="text-white truncate" title={selectedBartimeo.acudiente1_email}>{selectedBartimeo.acudiente1_email || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="bg-[#0a0a0a] p-4 rounded-xl border border-white/5 space-y-2 text-sm">
                                            <div className="font-bold text-white mb-2">Acudiente 2</div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="text-zinc-500">Nombre</div><div className="text-white">{selectedBartimeo.acudiente2_nombre || '-'}</div>
                                                <div className="text-zinc-500">Parentesco</div><div className="text-white">{selectedBartimeo.acudiente2_parentesco || '-'}</div>
                                                <div className="text-zinc-500">Teléfono</div>
                                                <div className="text-white font-bold flex items-center gap-2">
                                                    {selectedBartimeo.acudiente2_telefono || '-'}
                                                    {selectedBartimeo.acudiente2_telefono && (
                                                        <button onClick={(e) => handleWpClick(e, selectedBartimeo, selectedBartimeo.acudiente2_telefono, selectedBartimeo.acudiente2_nombre)} title="Hablar por WhatsApp" className="text-green-400 hover:text-green-300 transition text-lg bg-green-500/10 rounded-full px-2 py-0.5" style={{ textDecoration: 'none' }}>
                                                            <span role="img" aria-label="WhatsApp">💬</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="text-zinc-500">Email</div><div className="text-white truncate" title={selectedBartimeo.acudiente2_email}>{selectedBartimeo.acudiente2_email || '-'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Archivos */}
                                    <div className="space-y-4">
                                        <h4 className="text-brand font-bold text-sm uppercase tracking-widest border-b border-white/10 pb-2">Documentos Adjuntos</h4>
                                        <div className="flex flex-col gap-3">
                                                {selectedBartimeo.doc_identidad_url ? (
                                                    <a href={selectedBartimeo.doc_identidad_url} target="_blank" rel="noopener noreferrer" className="bg-[#0a0a0a] border border-white/10 hover:border-brand p-3 rounded-lg flex items-center gap-3 transition">
                                                        <span className="text-2xl">🪪</span>
                                                        <div>
                                                            <div className="text-white font-bold text-sm">Documento de Identidad</div>
                                                            <div className="text-zinc-500 text-xs">Abrir en Google Drive</div>
                                                        </div>
                                                    </a>
                                                ) : (
                                                    <div className="bg-[#0a0a0a] border border-white/5 p-3 rounded-lg flex items-center gap-3 opacity-50">
                                                        <span className="text-2xl">🪪</span><div className="text-zinc-500 text-sm">Sin documento</div>
                                                    </div>
                                                )}
                                                {selectedBartimeo.eps_certificado_url ? (
                                                    <a href={selectedBartimeo.eps_certificado_url} target="_blank" rel="noopener noreferrer" className="bg-[#0a0a0a] border border-white/10 hover:border-brand p-3 rounded-lg flex items-center gap-3 transition">
                                                        <span className="text-2xl">🏥</span>
                                                        <div>
                                                            <div className="text-white font-bold text-sm">Certificado EPS</div>
                                                            <div className="text-zinc-500 text-xs">Abrir en Google Drive</div>
                                                        </div>
                                                    </a>
                                                ) : (
                                                    <div className="bg-[#0a0a0a] border border-white/5 p-3 rounded-lg flex items-center gap-3 opacity-50">
                                                        <span className="text-2xl">🏥</span><div className="text-zinc-500 text-sm">Sin certificado</div>
                                                    </div>
                                                )}
                                        </div>

                                        <div className="mt-8">
                                            <h4 className="text-brand font-bold text-sm uppercase tracking-widest border-b border-white/10 pb-2 mb-4">Estado General (Coordinación)</h4>
                                            <div className="space-y-4 text-sm bg-[#0a0a0a] p-4 rounded-xl border border-white/5">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-zinc-500 font-bold">Estado de Clasificación</span>
                                                    <button 
                                                        onClick={() => setTrackingState({...trackingState, es_candidato: !trackingState.es_candidato})}
                                                        className={`px-3 py-1 rounded font-bold ${trackingState.es_candidato ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                                                    >
                                                        {trackingState.es_candidato ? '✅ Es Candidato' : '❌ No Clasifica'}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center mt-4">
                                                    <span className="text-zinc-500 font-bold">Participación Confirmada</span>
                                                    <button 
                                                        onClick={() => setTrackingState({...trackingState, participacion_confirmada: !trackingState.participacion_confirmada})}
                                                        className={`px-3 py-1 rounded font-bold ${trackingState.participacion_confirmada ? 'bg-brand/20 text-brand' : 'bg-zinc-800 text-zinc-500'}`}
                                                    >
                                                        {trackingState.participacion_confirmada ? '🙌 Confirmado' : '⏳ Esperando...'}
                                                    </button>
                                                </div>
                                                <div className="flex justify-between items-center mt-4">
                                                    <span className="text-zinc-500 font-bold">Beca Asignada</span>
                                                    <select 
                                                        value={trackingState.beca_otorgada}
                                                        onChange={e => setTrackingState({...trackingState, beca_otorgada: e.target.value})}
                                                        className={`px-3 py-1 rounded font-bold outline-none cursor-pointer ${
                                                            trackingState.beca_otorgada !== 'Ninguna' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-zinc-800 text-zinc-500'
                                                        }`}
                                                    >
                                                        <option value="Ninguna">Ninguna</option>
                                                        <option value="Media Beca">Media Beca</option>
                                                        <option value="Beca Completa">Beca Completa</option>
                                                    </select>
                                                </div>
                                                <div className="flex justify-between items-center mt-4">
                                                    <span className="text-zinc-500 font-bold">Género (Forzar)</span>
                                                    <select 
                                                        value={trackingState.genero_override || ''}
                                                        onChange={e => setTrackingState({...trackingState, genero_override: e.target.value})}
                                                        className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded font-bold outline-none cursor-pointer"
                                                    >
                                                        <option value="">Automático</option>
                                                        <option value="Chico">Chico</option>
                                                        <option value="Chica">Chica</option>
                                                    </select>
                                                </div>
                                                <div className="pt-4 border-t border-white/10 mt-4">
                                                    <label className="block text-zinc-500 font-bold text-xs mb-2 uppercase tracking-wider">Anotaciones / Comentarios</label>
                                                    <textarea 
                                                        value={trackingState.comentarios} 
                                                        onChange={e => setTrackingState({...trackingState, comentarios: e.target.value})}
                                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-3 text-white focus:border-brand focus:outline-none h-24 resize-none"
                                                        placeholder="Dudas, situación particular, etc."
                                                    />
                                                </div>
                                                <button 
                                                    onClick={handleSaveTracking} 
                                                    disabled={savingTracking} 
                                                    className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white font-bold py-2 rounded-lg transition"
                                                >
                                                    {savingTracking ? 'Guardando...' : 'Guardar Estado General'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'pagos' && (
                                <div className="space-y-6">
                                    <div className="bg-[#161616] p-6 rounded-2xl border border-brand/30 flex justify-between items-center">
                                        <div>
                                            <div className="text-zinc-400 text-sm uppercase tracking-wider font-bold mb-1">Total Pagado</div>
                                            <div className="text-4xl font-mono font-bold text-green-400">
                                                ${(Number(selectedBartimeo.total_paid) || 0).toLocaleString('es-CO')}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-zinc-500 text-sm mb-1">Costo del Retiro</div>
                                            <div className="text-2xl font-mono text-white">$500.000</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <div className="lg:col-span-2 space-y-4">
                                            <h4 className="text-white font-bold">Historial de Pagos</h4>
                                            {loadingPayments ? (
                                                <div className="text-zinc-500 text-sm">Cargando pagos...</div>
                                            ) : payments.length === 0 ? (
                                                <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-8 text-center text-zinc-500 text-sm italic">
                                                    No hay pagos registrados para este inscrito.
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {payments.map(p => (
                                                        <div key={p.id} className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4 flex justify-between items-center">
                                                            <div className="flex items-center gap-4">
                                                                <div className="bg-green-500/10 p-3 rounded-full text-green-400">
                                                                    💰
                                                                </div>
                                                                <div>
                                                                    <div className="font-mono font-bold text-lg text-white">${(p.amount).toLocaleString('es-CO')}</div>
                                                                    <div className="text-zinc-500 text-xs flex gap-2">
                                                                        <span className="text-brand">{p.payment_method}</span>
                                                                        <span>• {new Date(p.created_at).toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {p.receipt_url && (
                                                                <button 
                                                                    onClick={() => handleViewReceipt(p.receipt_url)}
                                                                    className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-xs font-bold text-white transition flex items-center gap-2"
                                                                >
                                                                    👁️ Ver Comprobante
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-[#0a0a0a] p-5 rounded-2xl border border-white/10 h-fit">
                                            <h4 className="text-white font-bold mb-4">Registrar Nuevo Pago</h4>
                                            <form onSubmit={handleAddPayment} className="space-y-4 text-sm">
                                                <div>
                                                    <label className="block text-zinc-400 mb-1">Monto Pagado ($)</label>
                                                    <input 
                                                        type="number" 
                                                        required
                                                        value={newPaymentAmount}
                                                        onChange={e => setNewPaymentAmount(e.target.value)}
                                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white font-mono focus:border-brand outline-none"
                                                        placeholder="Ej: 200000"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-zinc-400 mb-1">Medio de Pago</label>
                                                    <select 
                                                        value={newPaymentMethod}
                                                        onChange={e => setNewPaymentMethod(e.target.value)}
                                                        className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white focus:border-brand outline-none"
                                                    >
                                                        <option value="Nequi">Nequi</option>
                                                        <option value="Daviplata">Daviplata</option>
                                                        <option value="Transferencia Caja Social">Transferencia Caja Social</option>
                                                        <option value="Efectivo">Efectivo</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-zinc-400 mb-1">Comprobante (Imagen o PDF)</label>
                                                    <input 
                                                        type="file"
                                                        required
                                                        accept="image/*,application/pdf"
                                                        onChange={e => setUploadReceiptFile(e.target.files?.[0] || null)}
                                                        className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-brand/20 file:text-brand hover:file:bg-brand/30 transition cursor-pointer"
                                                    />
                                                </div>
                                                <button 
                                                    type="submit"
                                                    disabled={addingPayment || !uploadReceiptFile || !newPaymentAmount}
                                                    className="w-full bg-brand text-black font-bold py-2.5 rounded-lg hover:bg-white transition disabled:opacity-50 mt-4"
                                                >
                                                    {addingPayment ? 'Guardando...' : 'Guardar Pago'}
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'contactos' && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 space-y-4">
                                        <h4 className="text-white font-bold">Historial de Contactos</h4>
                                        {loadingContacts ? (
                                            <div className="text-zinc-500 text-sm">Cargando contactos...</div>
                                        ) : contacts.length === 0 ? (
                                            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-8 text-center text-zinc-500 text-sm italic">
                                                No hay registros de contacto para este inscrito.
                                            </div>
                                        ) : (
                                            <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                                                {contacts.map((c, i) => (
                                                    <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-[#161616] shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow ${c.contact_method === 'WhatsApp' ? 'bg-green-500 text-black' : c.contact_method === 'Correo' ? 'bg-blue-500 text-white' : 'bg-yellow-500 text-black'}`}>
                                                            {c.contact_method === 'WhatsApp' ? '📱' : c.contact_method === 'Correo' ? '✉️' : '📞'}
                                                        </div>
                                                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-[#0a0a0a] p-4 rounded-xl border border-white/5 shadow">
                                                            <div className="flex items-center justify-between space-x-2 mb-1">
                                                                <div className="font-bold text-white">{c.coordinator_name}</div>
                                                                <time className="text-xs text-brand font-mono">{new Date(c.created_at).toLocaleString('es-CO', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}</time>
                                                            </div>
                                                            <div className="text-zinc-400 text-sm">
                                                                Contactó a <strong>{c.target_person}</strong> vía {c.contact_method}.
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-6">
                                        <div className="bg-[#0a0a0a] p-5 rounded-2xl border border-white/10">
                                            <h4 className="text-white font-bold mb-4">Registrar Contacto Manual</h4>
                                            <form onSubmit={handleAddContact} className="space-y-4 text-sm">
                                                <div>
                                                    <label className="block text-zinc-400 mb-1">¿A quién contactaste?</label>
                                                    <select value={newContactTarget} onChange={e => setNewContactTarget(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white outline-none">
                                                        <option value="Acudiente 1">Acudiente 1 ({selectedBartimeo.acudiente1_nombre || 'N/A'})</option>
                                                        <option value="Acudiente 2">Acudiente 2 ({selectedBartimeo.acudiente2_nombre || 'N/A'})</option>
                                                        <option value="Participante">Participante</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-zinc-400 mb-1">Medio</label>
                                                    <select value={newContactMethod} onChange={e => setNewContactMethod(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white outline-none">
                                                        <option value="WhatsApp">WhatsApp</option>
                                                        <option value="Llamada">Llamada</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-zinc-400 mb-1">Tu Nombre (Coordi)</label>
                                                    <select value={newContactCoordi} onChange={e => setNewContactCoordi(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-lg p-2.5 text-white outline-none">
                                                        <option value="Aleja">Aleja</option>
                                                        <option value="Nico">Nico</option>
                                                        <option value="Jesus">Jesus</option>
                                                    </select>
                                                </div>
                                                <button 
                                                    type="submit"
                                                    disabled={addingContact}
                                                    className="w-full bg-white/10 text-white font-bold py-2.5 rounded-lg hover:bg-white hover:text-black transition disabled:opacity-50 mt-2"
                                                >
                                                    {addingContact ? 'Guardando...' : 'Guardar Registro'}
                                                </button>
                                            </form>
                                        </div>

                                        <div className="bg-brand/10 p-5 rounded-2xl border border-brand/30">
                                            <h4 className="text-brand font-bold mb-2">Enviar Correo Oficial</h4>
                                            <p className="text-xs text-zinc-400 mb-4">Envía el correo de aceptación con los datos de pago al acudiente.</p>
                                            <button 
                                                onClick={() => setEmailModalOpen(true)}
                                                disabled={!selectedBartimeo.es_candidato}
                                                className="w-full bg-brand text-black font-bold py-2.5 rounded-lg hover:bg-white transition disabled:opacity-50"
                                            >
                                                ✉️ Configurar Envío
                                            </button>
                                            {!selectedBartimeo.es_candidato && <p className="text-[10px] text-red-400 mt-2 text-center font-bold">Debe ser candidato para enviar el correo.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* Email Confirmation Modal */}
            {emailModalOpen && selectedBartimeo && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-[#111] border border-brand/30 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-2">Enviar Correo de Aceptación</h3>
                        <p className="text-sm text-zinc-400 mb-6">El sistema enviará el correo automático con las instrucciones y medios de pago.</p>
                        
                        {selectedBartimeo.correo_enviado && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-6">
                                <p className="text-red-400 text-sm font-bold flex items-center gap-2">⚠️ Ya se ha enviado antes</p>
                                <p className="text-red-400/80 text-xs mt-1">Este participante ya tiene marcado el correo como enviado. Si continúas, volverás a enviarlo.</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="bg-[#0a0a0a] p-4 rounded-xl border border-white/10">
                                <label className="block text-white text-sm font-bold mb-3">¿Cómo nos dirigimos al joven?</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" checked={emailGender === 'chico'} onChange={() => setEmailGender('chico')} className="accent-brand w-4 h-4" />
                                        <span className="text-zinc-300 text-sm">Chico (hijo)</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" checked={emailGender === 'chica'} onChange={() => setEmailGender('chica')} className="accent-brand w-4 h-4" />
                                        <span className="text-zinc-300 text-sm">Chica (hija)</span>
                                    </label>
                                </div>
                            </div>
                            
                            <div className="bg-[#0a0a0a] p-4 rounded-xl border border-white/10">
                                <label className="block text-white text-sm font-bold mb-3">Opciones de Envío</label>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-zinc-500 block mb-1">Destinatario</label>
                                        <select value={emailTargetPerson} onChange={e => setEmailTargetPerson(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-lg p-2 text-white outline-none text-sm">
                                            <option value="Ambos">Ambos Acudientes</option>
                                            <option value="Acudiente 1">Solo Acudiente 1</option>
                                            <option value="Acudiente 2">Solo Acudiente 2</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-zinc-500 block mb-1">¿Quién lo está enviando? (Quedará en el historial)</label>
                                        <select value={emailCoordinator} onChange={e => setEmailCoordinator(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-lg p-2 text-white outline-none text-sm">
                                            <option value="Aleja">Aleja</option>
                                            <option value="Nico">Nico</option>
                                            <option value="Jesus">Jesus</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex gap-3 justify-end">
                            <button 
                                onClick={() => setEmailModalOpen(false)}
                                disabled={sendingEmail}
                                className="px-4 py-2 rounded-lg text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSendEmail}
                                disabled={sendingEmail}
                                className="px-6 py-2 rounded-lg text-sm font-bold bg-brand text-black hover:bg-white transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {sendingEmail ? 'Enviando...' : 'Confirmar y Enviar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {wpActionModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-[#111] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fade-in-up">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                                💬
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Opciones de WhatsApp</h3>
                            <p className="text-sm text-zinc-400">
                                ¿Qué tipo de mensaje deseas enviar a {(wpActionModal.acudienteName || 'esta persona').split(' ')[0]}?
                            </p>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    window.open(getWpLink(wpActionModal.bartimeo, wpActionModal.phone, wpActionModal.acudienteName), '_blank');
                                    setWpActionModal(null);
                                }}
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-xl transition flex flex-col items-center justify-center"
                            >
                                <span>Mensaje Oficial</span>
                                <span className="text-[10px] font-normal opacity-80 mt-1">Plantilla de Aceptación Pre-escrita</span>
                            </button>
                            
                            <button
                                onClick={() => {
                                    const cleanPhone = wpActionModal.phone.replace(/\D/g, '');
                                    const finalPhone = cleanPhone.startsWith('57') ? cleanPhone : (cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone);
                                    window.open(`https://api.whatsapp.com/send/?phone=${finalPhone}&type=phone_number&app_absent=0`, '_blank');
                                    setWpActionModal(null);
                                }}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3 px-4 rounded-xl transition flex flex-col items-center justify-center"
                            >
                                <span>Chat Vacío</span>
                                <span className="text-[10px] font-normal text-zinc-400 mt-1">Escribir un mensaje personalizado</span>
                            </button>
                            
                            <button
                                onClick={() => setWpActionModal(null)}
                                className="w-full text-zinc-500 hover:text-white text-sm font-bold py-2 mt-2 transition"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
