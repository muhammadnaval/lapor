import { Head, Link, router, usePage } from "@inertiajs/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import Layout from "../components/Layout";
import type { Paginated, User, Role } from "../../shared/types";
import { isReportAnonymous } from "../../shared/types";
import "./Admin.css";
import { formatDate, formatDateIndonesian, formatDateTime, formatDateTimeIndonesian } from "../../shared/date";

interface ReportItem {
	id: number;
	ticketNumber: string;
	secretCodeHash?: string;
	jenis: string;
	kategori: string;
	judul: string;
	kronologi: string;
	tanggalKejadian?: string | null;
	lokasiKejadian?: string | null;
	pihakTerkait?: string | null;
	isAnonymous: boolean | number;
	reporterName?: string | null;
	reporterEmail?: string | null;
	reporterPhone?: string | null;
	status: string;
	detailedStatus: string;
	priority: string;
	priorityLevel?: number;
	unitDisposisi: string;
	slaTarget?: string | null;
	createdAt: string;
	updatedAt?: string;
}

interface MessageItem {
	id: number;
	reportId: number;
	senderType: string;
	senderName: string;
	content: string;
	isInternalNote: number | boolean;
	createdAt: string;
}

interface StatusHistoryItem {
	id: number;
	reportId: number;
	fromStatus: string | null;
	toStatus: string;
	actorUserId: number | null;
	actorName: string;
	reason: string | null;
	createdAt: string;
}

interface AttachmentItem {
	id: number;
	reportId: number;
	uploadId: string;
	fileName: string;
	fileSize: number;
	mimeType: string;
	createdAt: string;
}

interface AssignmentItem {
	id: number;
	reportId: number;
	assignedToUserId: number | null;
	unitName: string;
	deadlineAt: string | null;
	notes: string | null;
	createdAt: string;
}

interface CaseActionItem {
	id: number;
	reportId: number;
	title: string;
	isCompleted: number;
	completedByUserId: number | null;
	completedAt: string | null;
	createdAt: string;
}

interface AuditLogItem {
	id: number;
	userId?: number | null;
	timestamp?: string;
	actorName: string;
	action: string;
	target: string;
	ipAddress: string;
	detail: string;
	createdAt?: string;
}

interface CategoryItem {
	id: number;
	jenis: string;
	name: string;
	description: string | null;
	createdAt: string;
}

interface UnitItem {
	id: number;
	name: string;
	headName: string;
	email: string;
	createdAt: string;
}

interface HolidayItem {
	id: number;
	holidayDate: string;
	title: string;
	createdAt: string;
}

interface FaqItem {
	id: number;
	question: string;
	answer: string;
	category: string;
	isActive: number;
	createdAt: string;
}

interface ContactItem {
	id: number;
	name: string;
	type: string;
	value: string;
	createdAt: string;
}

interface AdminProps {
	users?: Paginated<User>;
	dbReports?: Paginated<ReportItem>;
	auditLogs?: Paginated<AuditLogItem> | AuditLogItem[];
	categories?: CategoryItem[];
	units?: UnitItem[];
	holidays?: HolidayItem[];
	faqs?: FaqItem[];
	contacts?: ContactItem[];
	systemSettings?: Record<string, string>;
	userFilters?: {
		search?: string;
		role?: string;
	};
	auditFilters?: {
		search?: string;
	};
	filters?: {
		search?: string;
		status?: string;
		jenis?: string;
		priority?: string;
	};
}

export default function Admin({
	users,
	dbReports,
	auditLogs = [],
	categories = [],
	units = [],
	holidays = [],
	faqs = [],
	contacts = [],
	systemSettings = {},
	userFilters = {},
	auditFilters = {},
	filters = {},
}: AdminProps) {
	const { props } = usePage();
	const currentUser = props.auth?.user;
	const userRole: Role = currentUser?.role || "user";

	const auditLogsData: AuditLogItem[] = Array.isArray(auditLogs) ? auditLogs : auditLogs.data;
	const auditLogsMeta = Array.isArray(auditLogs) ? null : auditLogs.meta;

	// Active Main Tab
	const [activeTab, setActiveTab] = useState<"triage" | "officers" | "audit" | "settings">(() => {
		if (typeof window !== "undefined") {
			const params = new URLSearchParams(window.location.search);
			const tabParam = params.get("tab");
			if (tabParam === "officers" || tabParam === "audit" || tabParam === "settings" || tabParam === "triage") {
				return tabParam;
			}
			if (params.get("auditPage") || params.get("auditSearch")) {
				return "audit";
			}
			if (params.get("userPage") || params.get("userSearch") || params.get("userRole")) {
				return "officers";
			}
		}
		return "triage";
	});

	// Audit Log Search state
	const [auditSearchKeyword, setAuditSearchKeyword] = useState<string>(auditFilters.search || "");

	const handleAuditSearchSubmit = (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		router.get(
			"/admin",
			{
				auditSearch: auditSearchKeyword,
				auditPage: 1,
			},
			{ preserveState: true, preserveScroll: true },
		);
	};

	// User Search & Role Filter states
	const [userSearchKeyword, setUserSearchKeyword] = useState<string>(userFilters.search || "");
	const [userRoleFilter, setUserRoleFilter] = useState<string>(userFilters.role || "semua");

	const handleUserSearchSubmit = (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		router.get(
			"/admin",
			{
				userSearch: userSearchKeyword,
				userRole: userRoleFilter,
				userPage: 1,
			},
			{ preserveState: true, preserveScroll: true },
		);
	};

	// Triage Filter states
	const [searchKeyword, setSearchKeyword] = useState<string>(filters.search || "");
	const [statusFilter, setStatusFilter] = useState<string>(filters.status || "semua");
	const [jenisFilter, setJenisFilter] = useState<string>(filters.jenis || "semua");
	const [priorityFilter, setPriorityFilter] = useState<string>(filters.priority || "semua");

	// Drawer and Detail State
	const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
	const [reportDetail, setReportDetail] = useState<{
		report: ReportItem;
		messages: MessageItem[];
		statusHistory: StatusHistoryItem[];
		attachments: AttachmentItem[];
		assignments: AssignmentItem[];
		caseActions: CaseActionItem[];
	} | null>(null);
	const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
	const [detailTab, setDetailTab] = useState<"summary" | "attachments" | "messages" | "notes" | "actions" | "history">("summary");

	// Identity Access Form State
	const [showIdentityModal, setShowIdentityModal] = useState<boolean>(false);
	const [identityReason, setIdentityReason] = useState<string>("");
	const [unencryptedIdentity, setUnencryptedIdentity] = useState<{ name: string | null; email: string | null; phone: string | null } | null>(null);
	const [identityError, setIdentityError] = useState<string>("");

	// Action Modal States (Forward, Reject, Duplicate, Close, Reopen)
	const [actionModalType, setActionModalType] = useState<"forward" | "reject" | "duplicate" | "close" | "reopen" | null>(null);
	const [actionReason, setActionReason] = useState<string>("");
	const [actionExtraInput, setActionExtraInput] = useState<string>("");
	const [actionError, setActionError] = useState<string>("");
	const [submittingAction, setSubmittingAction] = useState<boolean>(false);

	// Quick Form States inside drawer
	const [statusForm, setStatusForm] = useState<string>("");
	const [unitForm, setUnitForm] = useState<string>("");
	const [priorityForm, setPriorityForm] = useState<string>("");
	const [newInternalNote, setNewInternalNote] = useState<string>("");
	const [newPublicMsg, setNewPublicMsg] = useState<string>("");
	const [newActionTitle, setNewActionTitle] = useState<string>("");

	// F09 Master Data States
	const [instansiName, setInstansiName] = useState<string>("MTsN 3 Kota Padang");
	const [instansiEmail, setInstansiEmail] = useState<string>("info@mtsn3padang.sch.id");
	const [retentionDays, setRetentionDays] = useState<number>(365);
	const [maxUploadMb, setMaxUploadMb] = useState<number>(10);

	// System Settings Form States (Kop Surat & Lembar Pengesahan)
	const [kopInstansiUtama, setKopInstansiUtama] = useState<string>(
		systemSettings?.kopInstansiUtama || "KEMENTERIAN AGAMA REPUBLIK INDONESIA",
	);
	const [kopInstansiDaerah, setKopInstansiDaerah] = useState<string>(
		systemSettings?.kopInstansiDaerah || "KANTOR KEMENTERIAN AGAMA KOTA PADANG",
	);
	const [kopNamaMadrasah, setKopNamaMadrasah] = useState<string>(
		systemSettings?.kopNamaMadrasah || "MADRASAH TSANAWIYAH NEGERI 3 KOTA PADANG",
	);
	const [kopAlamatLengkap, setKopAlamatLengkap] = useState<string>(
		systemSettings?.kopAlamatLengkap || "Jl. Gunung Juaro, Surau Gadang, Kec. Nanggalo, Kota Padang, Sumatera Barat 25146",
	);
	const [sigLeftTitle, setSigLeftTitle] = useState<string>(
		systemSettings?.sigLeftTitle || "Mengetahui/Menyetujui,",
	);
	const [sigLeftJabatan, setSigLeftJabatan] = useState<string>(
		systemSettings?.sigLeftJabatan || "Kepala MTsN 3 Kota Padang",
	);
	const [sigLeftNama, setSigLeftNama] = useState<string>(
		systemSettings?.sigLeftNama || "Nurhidayati, S.T., M.Pd.",
	);
	const [sigLeftNip, setSigLeftNip] = useState<string>(
		systemSettings?.sigLeftNip || "NIP. 197508122005012004",
	);
	const [sigRightKota, setSigRightKota] = useState<string>(
		systemSettings?.sigRightKota || "Padang",
	);
	const [sigRightJabatan, setSigRightJabatan] = useState<string>(
		systemSettings?.sigRightJabatan || "Petugas Penanggung Jawab / Triase",
	);
	const [savingSettings, setSavingSettings] = useState<boolean>(false);
	const [settingsSuccessMsg, setSettingsSuccessMsg] = useState<string>("");

	const handleSaveKopAndSignatureSettings = async (e: React.FormEvent) => {
		e.preventDefault();
		setSavingSettings(true);
		setSettingsSuccessMsg("");
		try {
			const res = await fetch("/admin/settings", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					kopInstansiUtama,
					kopInstansiDaerah,
					kopNamaMadrasah,
					kopAlamatLengkap,
					sigLeftTitle,
					sigLeftJabatan,
					sigLeftNama,
					sigLeftNip,
					sigRightKota,
					sigRightJabatan,
				}),
			});
			if (res.ok) {
				setSettingsSuccessMsg("✅ Pengaturan Kop Surat & Lembar Pengesahan berhasil disimpan!");
				router.reload();
			} else {
				alert("Gagal menyimpan pengaturan.");
			}
		} catch {
			alert("Koneksi gagal saat menyimpan pengaturan.");
		} finally {
			setSavingSettings(false);
		}
	};

	const [newCatJenis, setNewCatJenis] = useState<string>("Pengaduan");
	const [newCatName, setNewCatName] = useState<string>("");
	const [newCatDesc, setNewCatDesc] = useState<string>("");

	const [newUnitName, setNewUnitName] = useState<string>("");
	const [newUnitHead, setNewUnitHead] = useState<string>("");
	const [newUnitEmail, setNewUnitEmail] = useState<string>("");

	const [newHolidayDate, setNewHolidayDate] = useState<string>("");
	const [newHolidayTitle, setNewHolidayTitle] = useState<string>("");

	const [newFaqQuestion, setNewFaqQuestion] = useState<string>("");
	const [newFaqAnswer, setNewFaqAnswer] = useState<string>("");
	const [newFaqCategory, setNewFaqCategory] = useState<string>("Umum");

	const [newContactName, setNewContactName] = useState<string>("");
	const [newContactType, setNewContactType] = useState<string>("telepon");
	const [newContactValue, setNewContactValue] = useState<string>("");

	// User & Role Management States
	const [showCreateUserModal, setShowCreateUserModal] = useState<boolean>(false);
	const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
	const [selectedUserForDelete, setSelectedUserForDelete] = useState<User | null>(null);
	const [newUserName, setNewUserName] = useState<string>("");
	const [newUserEmail, setNewUserEmail] = useState<string>("");
	const [newUserPassword, setNewUserPassword] = useState<string>("");
	const [newUserRole, setNewUserRole] = useState<Role>("petugas_triase");
	const [editUserRole, setEditUserRole] = useState<Role>("user");
	const [userActionError, setUserActionError] = useState<string>("");
	const [submittingUserAction, setSubmittingUserAction] = useState<boolean>(false);

	const handleCreateUserSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setUserActionError("");
		setSubmittingUserAction(true);

		try {
			const res = await fetch("/admin/users/create", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					name: newUserName.trim(),
					email: newUserEmail.trim(),
					password: newUserPassword,
					role: newUserRole,
				}),
			});
			const data = await res.json();
			if (res.ok) {
				setShowCreateUserModal(false);
				setNewUserName("");
				setNewUserEmail("");
				setNewUserPassword("");
				setNewUserRole("petugas_triase");
				router.reload({ only: ["users", "auditLogs"] });
			} else {
				setUserActionError(data.error || "Gagal membuat pengguna baru.");
			}
		} catch (err) {
			setUserActionError("Terjadi kesalahan koneksi.");
		} finally {
			setSubmittingUserAction(false);
		}
	};

	const handleEditRoleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedUserForEdit) return;
		setUserActionError("");
		setSubmittingUserAction(true);

		try {
			const res = await fetch(`/admin/users/${selectedUserForEdit.id}/role`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ role: editUserRole }),
			});
			const data = await res.json();
			if (res.ok) {
				setSelectedUserForEdit(null);
				router.reload({ only: ["users", "auditLogs"] });
			} else {
				setUserActionError(data.error || "Gagal mengubah peran pengguna.");
			}
		} catch (err) {
			setUserActionError("Terjadi kesalahan koneksi.");
		} finally {
			setSubmittingUserAction(false);
		}
	};

	const handleDeleteUserSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedUserForDelete) return;
		setUserActionError("");
		setSubmittingUserAction(true);

		try {
			const res = await fetch(`/admin/users/${selectedUserForDelete.id}`, {
				method: "DELETE",
			});
			const data = await res.json();
			if (res.ok) {
				setSelectedUserForDelete(null);
				router.reload({ only: ["users", "auditLogs"] });
			} else {
				setUserActionError(data.error || "Gagal menghapus pengguna.");
			}
		} catch (err) {
			setUserActionError("Terjadi kesalahan koneksi.");
		} finally {
			setSubmittingUserAction(false);
		}
	};

	// Collapsible Sidebar State
	const [isSidebarHidden, setIsSidebarHidden] = useState<boolean>(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("admin_sidebar_hidden") === "true";
		}
		return false;
	});

	const toggleSidebar = () => {
		setIsSidebarHidden((prev) => {
			const next = !prev;
			if (typeof window !== "undefined") {
				localStorage.setItem("admin_sidebar_hidden", String(next));
			}
			return next;
		});
	};

	// Fetch Report Detail
	const fetchReportDetail = async (id: number) => {
		setLoadingDetail(true);
		setUnencryptedIdentity(null);
		try {
			const res = await fetch(`/admin/report/${id}`);
			if (res.ok) {
				const data = await res.json();
				setReportDetail(data);
				setStatusForm(data.report.detailedStatus || data.report.status);
				setUnitForm(data.report.unitDisposisi || "Tim Investigasi Internal");
				setPriorityForm(data.report.priority || "Sedang");
			} else {
				alert("Gagal memuat detail laporan.");
			}
		} catch (e) {
			console.error(e);
		} finally {
			setLoadingDetail(false);
		}
	};

	const openReportDetail = (report: ReportItem) => {
		setSelectedReportId(report.id);
		setDetailTab("summary");
		fetchReportDetail(report.id);
	};

	// Trigger Filter Search
	const handleApplyFilters = (overrides: { search?: string; status?: string; jenis?: string; priority?: string } | React.MouseEvent = {}) => {
		const isEvent = overrides && "preventDefault" in overrides;
		const search = (!isEvent && overrides.search !== undefined) ? overrides.search : searchKeyword;
		const status = (!isEvent && overrides.status !== undefined) ? overrides.status : statusFilter;
		const jenis = (!isEvent && overrides.jenis !== undefined) ? overrides.jenis : jenisFilter;
		const priority = (!isEvent && overrides.priority !== undefined) ? overrides.priority : priorityFilter;

		router.get(
			"/admin",
			{ search, status, jenis, priority, page: 1 },
			{ preserveState: true },
		);
	};

	const handleResetFilters = () => {
		setSearchKeyword("");
		setStatusFilter("semua");
		setJenisFilter("semua");
		setPriorityFilter("semua");
		router.get("/admin", {}, { preserveState: true });
	};

	// Access Reporter Identity
	const handleAccessIdentitySubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!selectedReportId) return;
		
		const formData = new FormData(e.currentTarget);
		const formReason = (formData.get("identReason") as string) || "";
		const trimmedReason = (formReason || identityReason).trim();

		if (trimmedReason.length < 10) {
			setIdentityError(`Alasan wajib diisi minimal 10 karakter. (Saat ini: ${trimmedReason.length} karakter)`);
			return;
		}
		setIdentityError("");

		try {
			const res = await fetch(`/admin/report/${selectedReportId}/identity`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ reason: trimmedReason }),
			});
			const data = await res.json();
			if (res.ok && data.identity) {
				setUnencryptedIdentity(data.identity);
				setShowIdentityModal(false);
				setIdentityReason("");
			} else {
				setIdentityError(data.error || data.message || "Gagal meng-akses identitas pelapor.");
			}
		} catch (err: any) {
			setIdentityError(`Terjadi kesalahan jaringan: ${err.message || "Gagal tersambung"}`);
		}
	};

	// Generic Action Handler for Forward, Reject, Duplicate, Close, Reopen
	const handleActionModalSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedReportId || !actionModalType) return;
		if (["reject", "forward", "duplicate", "close", "reopen"].includes(actionModalType) && actionReason.trim().length < 10) {
			setActionError("Alasan / ringkasan wajib diisi minimal 10 karakter.");
			return;
		}
		setActionError("");
		setSubmittingAction(true);

		let endpoint = `/admin/report/${selectedReportId}/${actionModalType}`;
		let payload: any = { reason: actionReason.trim() };

		if (actionModalType === "forward") {
			payload.unitDisposisi = actionExtraInput.trim() || "Tim Investigasi Internal";
		} else if (actionModalType === "duplicate") {
			payload.duplicateTicket = actionExtraInput.trim();
		} else if (actionModalType === "close") {
			payload.resolutionSummary = actionReason.trim();
		}

		try {
			const res = await fetch(endpoint, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (res.ok) {
				setActionModalType(null);
				setActionReason("");
				setActionExtraInput("");
				fetchReportDetail(selectedReportId);
				router.reload({ only: ["dbReports", "auditLogs"] });
			} else {
				setActionError(data.error || "Aksi gagal dijalankan.");
			}
		} catch (err) {
			setActionError("Terjadi kesalahan koneksi.");
		} finally {
			setSubmittingAction(false);
		}
	};

	// Perform Triase / Quick Status & Disposisi Update
	const handleTriaseSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedReportId) return;

		try {
			const res = await fetch(`/admin/report/${selectedReportId}/triase`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					priority: priorityForm,
					unitDisposisi: unitForm,
					notes: "Petugas triase memvalidasi dan mendisposisikan laporan.",
				}),
			});
			if (res.ok) {
				alert("Proses Triase & Disposisi berhasil disimpan!");
				fetchReportDetail(selectedReportId);
				router.reload({ only: ["dbReports"] });
			} else {
				const data = await res.json();
				alert(data.error || "Gagal memproses triase.");
			}
		} catch (err) {
			alert("Kesalahan jaringan.");
		}
	};

	// Add Internal Note
	const handleAddInternalNote = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedReportId || !newInternalNote.trim()) return;

		try {
			const res = await fetch(`/admin/report/${selectedReportId}/note`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ note: newInternalNote.trim() }),
			});
			if (res.ok) {
				setNewInternalNote("");
				fetchReportDetail(selectedReportId);
			} else {
				const data = await res.json();
				alert(data.error || "Gagal menambah catatan internal.");
			}
		} catch (err) {
			alert("Kesalahan jaringan.");
		}
	};

	// Add Public Message
	const handleAddPublicMsg = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedReportId || !newPublicMsg.trim()) return;

		try {
			const res = await fetch(`/admin/report/${selectedReportId}/message`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ content: newPublicMsg.trim() }),
			});
			if (res.ok) {
				setNewPublicMsg("");
				fetchReportDetail(selectedReportId);
			} else {
				const data = await res.json();
				alert(data.error || "Gagal mengirim pesan resmi.");
			}
		} catch (err) {
			alert("Kesalahan jaringan.");
		}
	};

	// Case Action Checklist Handlers
	const handleAddCaseAction = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedReportId || !newActionTitle.trim()) return;

		try {
			const res = await fetch(`/admin/report/${selectedReportId}/action`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ title: newActionTitle.trim() }),
			});
			if (res.ok) {
				setNewActionTitle("");
				fetchReportDetail(selectedReportId);
			}
		} catch (err) {
			console.error(err);
		}
	};

	const handleToggleAction = async (actionId: number, currentCompleted: number) => {
		if (!selectedReportId) return;
		try {
			const res = await fetch(`/admin/report/${selectedReportId}/action/${actionId}/toggle`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ isCompleted: currentCompleted ? 0 : 1 }),
			});
			if (res.ok) {
				fetchReportDetail(selectedReportId);
			}
		} catch (err) {
			console.error(err);
		}
	};

	// Master Data CRUD Handlers (F09)
	const handleAddCategory = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newCatName.trim()) return;
		const res = await fetch("/admin/master/categories", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ jenis: newCatJenis, name: newCatName.trim(), description: newCatDesc.trim() }),
		});
		if (res.ok) {
			setNewCatName("");
			setNewCatDesc("");
			router.reload({ only: ["categories"] });
		}
	};

	const handleDeleteCategory = async (id: number) => {
		if (confirm("Hapus kategori ini?")) {
			await fetch(`/admin/master/categories/${id}`, { method: "DELETE" });
			router.reload({ only: ["categories"] });
		}
	};

	const handleAddUnit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newUnitName.trim() || !newUnitHead.trim() || !newUnitEmail.trim()) return;
		const res = await fetch("/admin/master/units", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: newUnitName.trim(), headName: newUnitHead.trim(), email: newUnitEmail.trim() }),
		});
		if (res.ok) {
			setNewUnitName("");
			setNewUnitHead("");
			setNewUnitEmail("");
			router.reload({ only: ["units"] });
		}
	};

	const handleDeleteUnit = async (id: number) => {
		if (confirm("Hapus unit ini?")) {
			await fetch(`/admin/master/units/${id}`, { method: "DELETE" });
			router.reload({ only: ["units"] });
		}
	};

	const handleAddHoliday = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newHolidayDate.trim() || !newHolidayTitle.trim()) return;
		const res = await fetch("/admin/master/holidays", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ holidayDate: newHolidayDate.trim(), title: newHolidayTitle.trim() }),
		});
		if (res.ok) {
			setNewHolidayDate("");
			setNewHolidayTitle("");
			router.reload({ only: ["holidays"] });
		}
	};

	const handleDeleteHoliday = async (id: number) => {
		if (confirm("Hapus hari libur ini?")) {
			await fetch(`/admin/master/holidays/${id}`, { method: "DELETE" });
			router.reload({ only: ["holidays"] });
		}
	};

	const handleAddFaq = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) return;
		const res = await fetch("/admin/master/faqs", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ question: newFaqQuestion.trim(), answer: newFaqAnswer.trim(), category: newFaqCategory }),
		});
		if (res.ok) {
			setNewFaqQuestion("");
			setNewFaqAnswer("");
			router.reload({ only: ["faqs"] });
		}
	};

	const handleDeleteFaq = async (id: number) => {
		if (confirm("Hapus FAQ ini?")) {
			await fetch(`/admin/master/faqs/${id}`, { method: "DELETE" });
			router.reload({ only: ["faqs"] });
		}
	};

	const handleAddContact = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newContactName.trim() || !newContactValue.trim()) return;
		const res = await fetch("/admin/master/contacts", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: newContactName.trim(), type: newContactType, value: newContactValue.trim() }),
		});
		if (res.ok) {
			setNewContactName("");
			setNewContactValue("");
			router.reload({ only: ["contacts"] });
		}
	};

	const handleDeleteContact = async (id: number) => {
		if (confirm("Hapus kontak ini?")) {
			await fetch(`/admin/master/contacts/${id}`, { method: "DELETE" });
			router.reload({ only: ["contacts"] });
		}
	};

	const reportsList = dbReports?.data || [];
	const reportsMeta = dbReports?.meta || { currentPage: 1, lastPage: 1, total: 0, perPage: 20 };

	const isReadOnly = userRole === "pimpinan";

	return (
		<Layout>
			<Head title="Ruang Manajemen Backoffice & Triase Admin" />

			<div className="admin-workspace">
				<div className="admin-header">
					<div>
						<h1 className="admin-title">Portal Manajemen Backoffice & Triase</h1>
						<p className="admin-sub">
							Penanganan laporan, verifikasi triase, disposisi unit, audit trail, serta perlindungan whistleblower MTsN 3 Kota Padang.
						</p>
					</div>

					<div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
						<button
							type="button"
							className="sidebar-toggle-btn"
							onClick={toggleSidebar}
							title={isSidebarHidden ? "Tampilkan Sidebar Admin" : "Sembunyikan Sidebar Admin"}
						>
							{isSidebarHidden ? "📖 Tampilkan Navigasi Sidebar" : "📌 Sembunyikan Sidebar"}
						</button>
						<span className="badge badge-user" style={{ textTransform: "uppercase", padding: "0.4rem 0.8rem" }}>
							Peran: {userRole.replace("_", " ")}
						</span>
						<Link href="/dashboard" className="btn btn-ghost">
							📊 Dashboard Agregat
						</Link>
					</div>
				</div>

				<div className={`admin-body-layout ${isSidebarHidden ? "sidebar-hidden" : ""}`}>
					{/* Collapsible Admin Sidebar */}
					<aside className="admin-sidebar" aria-label="Admin Workspace Navigation">
						<div className="admin-sidebar-title">Menu Utama Admin</div>
						
						<button
							type="button"
							className={`admin-nav-item ${activeTab === "triage" ? "admin-nav-active" : ""}`}
							onClick={() => setActiveTab("triage")}
						>
							<span>📋 Antrean & Triase</span>
							<span className="admin-nav-badge">{reportsMeta.total}</span>
						</button>

						{(userRole === "admin" || userRole === "pimpinan") && (
							<button
								type="button"
								className={`admin-nav-item ${activeTab === "officers" ? "admin-nav-active" : ""}`}
								onClick={() => setActiveTab("officers")}
							>
								<span>👥 Pengguna & Petugas</span>
								<span className="admin-nav-badge">{users?.meta.total || 0}</span>
							</button>
						)}

						<button
							type="button"
							className={`admin-nav-item ${activeTab === "audit" ? "admin-nav-active" : ""}`}
							onClick={() => setActiveTab("audit")}
						>
							<span>📜 Audit Log & Keamanan</span>
						</button>

						{userRole === "admin" && (
							<button
								type="button"
								className={`admin-nav-item ${activeTab === "settings" ? "admin-nav-active" : ""}`}
								onClick={() => setActiveTab("settings")}
							>
								<span>⚙️ Master Data & SLA</span>
							</button>
						)}

						<div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border)" }}>
							<div className="admin-sidebar-title">Pintasan Cepat</div>
							<Link href="/dashboard" className="admin-nav-item">
								<span>📊 Dashboard Agregat</span>
							</Link>
						</div>
					</aside>

					{/* Admin Main Content Area */}
					<main className="admin-main-area">

				{activeTab === "triage" && (
					/* --- TAB 1: KELOLA ANTREAN LAPORAN --- */
					<div>
						{/* Filter Controls Bar */}
						<div className="filter-bar">
							<div className="form-group">
								<label className="form-label" htmlFor="searchKeyword">
									Pencarian Kata Kunci
								</label>
								<input
									id="searchKeyword"
									type="text"
									className="form-input"
									placeholder="No. Tiket, Judul, atau Nama Pelapor..."
									value={searchKeyword}
									onChange={(e) => setSearchKeyword(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
								/>
							</div>

							<div className="form-group">
								<label className="form-label" htmlFor="statusFilter">
									Filter Status
								</label>
								<select
									id="statusFilter"
									className="form-select"
									value={statusFilter}
									onChange={(e) => {
										const val = e.target.value;
										setStatusFilter(val);
										handleApplyFilters({ status: val });
									}}
								>
									<option value="semua">Semua Status</option>
									<option value="Terkirim">Terkirim</option>
									<option value="Verifikasi Awal">Verifikasi Awal</option>
									<option value="Perlu Informasi">Perlu Informasi</option>
									<option value="Diteruskan">Diteruskan</option>
									<option value="Dalam Penanganan">Dalam Penanganan</option>
									<option value="Selesai">Selesai</option>
									<option value="Ditutup">Ditutup</option>
									<option value="Ditolak">Ditolak</option>
									<option value="Dialihkan">Dialihkan</option>
									<option value="Duplikat">Duplikat</option>
									<option value="Dibuka Kembali">Dibuka Kembali</option>
								</select>
							</div>

							<div className="form-group">
								<label className="form-label" htmlFor="jenisFilter">
									Filter Jenis
								</label>
								<select
									id="jenisFilter"
									className="form-select"
									value={jenisFilter}
									onChange={(e) => {
										const val = e.target.value;
										setJenisFilter(val);
										handleApplyFilters({ jenis: val });
									}}
								>
									<option value="semua">Semua Jenis</option>
									<option value="whistleblowing">Whistleblowing</option>
									<option value="pengaduan">Pengaduan</option>
									<option value="aspirasi">Aspirasi</option>
								</select>
							</div>

							<div className="form-group">
								<label className="form-label" htmlFor="priorityFilter">
									Filter Prioritas
								</label>
								<select
									id="priorityFilter"
									className="form-select"
									value={priorityFilter}
									onChange={(e) => {
										const val = e.target.value;
										setPriorityFilter(val);
										handleApplyFilters({ priority: val });
									}}
								>
									<option value="semua">Semua Prioritas</option>
									<option value="Kritis">Kritis</option>
									<option value="Tinggi">Tinggi</option>
									<option value="Sedang">Sedang</option>
									<option value="Rendah">Rendah</option>
								</select>
							</div>

							<div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
								<button type="button" className="btn btn-ghost" onClick={handleResetFilters}>
									Reset Filter
								</button>
								<button type="button" className="btn btn-primary" onClick={handleApplyFilters}>
									🔍 Terapkan Filter
								</button>
							</div>
						</div>

						{/* Triage Reports Table */}
						<div className="triage-table-card" style={{ marginTop: "1.5rem" }}>
							<div className="table-wrap">
								<table className="triage-table">
									<thead>
										<tr>
											<th>Nomor Tiket</th>
											<th>Judul & Kategori</th>
											<th>Pelapor & Sifat</th>
											<th>Prioritas</th>
											<th>Status Kasus</th>
											<th>Unit Disposisi</th>
											<th>Aksi</th>
										</tr>
									</thead>
									<tbody>
										{reportsList.map((report) => (
											<tr key={report.id}>
												<td className="ticket-cell">{report.ticketNumber}</td>
												<td>
													<div className="title-cell-wrap">
														<span className="title-cell-title">{report.judul}</span>
														<span className="title-cell-sub">
															{report.jenis} : {report.kategori}
														</span>
													</div>
												</td>
												<td>
													<span style={{ fontWeight: 600 }}>
														{isReportAnonymous(report.isAnonymous) ? "🔒 Anonim" : `👤 ${report.reporterName || "Teridentifikasi"}`}
													</span>
												</td>
												<td>
													<span className={`badge-priority badge-p-${(report.priority || "Sedang").toLowerCase()}`}>
														● {report.priority || "Sedang"}
													</span>
												</td>
												<td>
													<span className={`badge-status badge-st-${(report.detailedStatus || report.status || "Terkirim").toLowerCase().replace(/\s+/g, "-")}`}>
														● {report.detailedStatus || report.status}
													</span>
												</td>
												<td>
													<span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{report.unitDisposisi}</span>
												</td>
												<td>
													<button
														type="button"
														className="btn btn-primary"
														style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
														onClick={() => openReportDetail(report)}
													>
														👁️ Kelola & Detail
													</button>
												</td>
											</tr>
										))}

										{reportsList.length === 0 && (
											<tr>
												<td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--muted)" }}>
													Tidak ditemukan laporan yang sesuai dengan kriteria pencarian dan filter.
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>

							{/* Pagination Bar */}
							<div className="pagination-bar">
								<span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
									Menampilkan halaman <strong>{reportsMeta.currentPage}</strong> dari <strong>{reportsMeta.lastPage}</strong> (Total {reportsMeta.total} laporan)
								</span>
								<div style={{ display: "flex", gap: "0.5rem" }}>
									<button
										type="button"
										className="btn btn-ghost"
										disabled={reportsMeta.currentPage <= 1}
										onClick={() =>
											router.get(
												"/admin",
												{ ...filters, page: reportsMeta.currentPage - 1 },
												{ preserveState: true },
											)
										}
									>
										&laquo; Sebelum
									</button>
									<button
										type="button"
										className="btn btn-ghost"
										disabled={reportsMeta.currentPage >= reportsMeta.lastPage}
										onClick={() =>
											router.get(
												"/admin",
												{ ...filters, page: reportsMeta.currentPage + 1 },
												{ preserveState: true },
											)
										}
									>
										Berikut &raquo;
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{activeTab === "officers" && users && (
					/* --- TAB 2: MANAJEMEN PENGGUNA & HAK AKSES --- */
					<div>
						<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
							<div>
								<h2 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Daftar Pengguna & Hak Akses Peran</h2>
								<p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
									Kelola akun petugas triase, penindak lanjut unit, admin, pimpinan, dan pelapor sistem.
								</p>
							</div>
							{userRole === "admin" && (
								<button
									type="button"
									className="btn btn-primary"
									onClick={() => {
										setUserActionError("");
										setShowCreateUserModal(true);
									}}
								>
									➕ Tambah Pengguna / Petugas Baru
								</button>
							)}
						</div>

						<div className="triage-table-card">
							{/* User Search & Filter Control Bar */}
							<form
								onSubmit={handleUserSearchSubmit}
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "1rem",
									padding: "1rem 1.25rem",
									borderBottom: "1px solid var(--border)",
									flexWrap: "wrap",
								}}
							>
								<div style={{ display: "flex", gap: "0.75rem", flex: 1, minWidth: "260px", flexWrap: "wrap" }}>
									<div className="form-group" style={{ flex: 1, margin: 0, minWidth: "200px" }}>
										<input
											type="text"
											className="form-input"
											placeholder="🔍 Cari nama pengguna atau email..."
											value={userSearchKeyword}
											onChange={(e) => setUserSearchKeyword(e.target.value)}
										/>
									</div>
									<div className="form-group" style={{ margin: 0, width: "180px" }}>
										<select
											className="form-select"
											value={userRoleFilter}
											onChange={(e) => {
												setUserRoleFilter(e.target.value);
												router.get(
													"/admin",
													{
														userSearch: userSearchKeyword,
														userRole: e.target.value,
														userPage: 1,
													},
													{ preserveState: true, preserveScroll: true },
												);
											}}
										>
											<option value="semua">Semua Peran</option>
											<option value="admin">⚙️ Admin</option>
											<option value="petugas_triase">📋 Petugas Triase</option>
											<option value="penindak_lanjut">🛠️ Penindak Lanjut</option>
											<option value="pimpinan">📊 Pimpinan</option>
											<option value="user">👤 Pelapor (User)</option>
										</select>
									</div>
									<button type="submit" className="btn btn-primary">
										Cari
									</button>
									{(userSearchKeyword || userRoleFilter !== "semua") && (
										<button
											type="button"
											className="btn btn-ghost"
											onClick={() => {
												setUserSearchKeyword("");
												setUserRoleFilter("semua");
												router.get("/admin", { userPage: 1 }, { preserveState: true, preserveScroll: true });
											}}
										>
											Reset Filter
										</button>
									)}
								</div>
							</form>

							<div className="table-wrap">
								<table className="triage-table">
									<thead>
										<tr>
											<th>ID</th>
											<th>Nama Lengkap</th>
											<th>Alamat Email</th>
											<th>Peran / Hak Akses</th>
											<th>Tanggal Terdaftar</th>
											{userRole === "admin" && <th style={{ textAlign: "right" }}>Kelola Akses</th>}
										</tr>
									</thead>
									<tbody>
										{users.data.map((u) => (
											<tr key={u.id}>
												<td className="ticket-cell">#{u.id}</td>
												<td style={{ fontWeight: 700 }}>{u.name}</td>
												<td>{u.email}</td>
												<td>
													<span
														className={`badge ${
															u.role === "admin"
																? "badge-danger"
																: u.role === "petugas_triase"
																? "badge-warning"
																: u.role === "penindak_lanjut"
																? "badge-info"
																: u.role === "pimpinan"
																? "badge-success"
																: "badge-user"
														}`}
														style={{ textTransform: "uppercase", padding: "0.35rem 0.65rem" }}
													>
														{u.role === "admin" && "⚙️ Admin"}
														{u.role === "petugas_triase" && "📋 Petugas Triase"}
														{u.role === "penindak_lanjut" && "🛠️ Penindak Lanjut"}
														{u.role === "pimpinan" && "📊 Pimpinan"}
														{u.role === "user" && "👤 Pelapor (User)"}
													</span>
												</td>
												<td style={{ fontSize: "0.86rem", color: "var(--muted)" }}>{formatDateTime(u.createdAt)}</td>
												{userRole === "admin" && (
													<td style={{ textAlign: "right" }}>
														<div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
															<button
																type="button"
																className="btn btn-ghost"
																style={{ fontSize: "0.82rem", padding: "0.3rem 0.6rem" }}
																onClick={() => {
																	setUserActionError("");
																	setSelectedUserForEdit(u);
																	setEditUserRole(u.role);
																}}
															>
																✏️ Ubah Peran
															</button>
															{currentUser?.id !== u.id && (
																<button
																	type="button"
																	className="btn btn-ghost"
																	style={{ fontSize: "0.82rem", padding: "0.3rem 0.6rem", color: "var(--danger)" }}
																	onClick={() => {
																		setUserActionError("");
																		setSelectedUserForDelete(u);
																	}}
																>
																	🗑️ Hapus
																</button>
															)}
														</div>
													</td>
												)}
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* User Pagination Bar */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "1rem 1.25rem",
									borderTop: "1px solid var(--border)",
									fontSize: "0.86rem",
									color: "var(--muted)",
									flexWrap: "wrap",
									gap: "0.75rem",
								}}
							>
								<div>
									Menampilkan {users.data.length > 0 ? (users.meta.currentPage - 1) * users.meta.perPage + 1 : 0}{" "}
									sampai {Math.min(users.meta.currentPage * users.meta.perPage, users.meta.total)} dari{" "}
									<strong>{users.meta.total}</strong> Pengguna Terdaftar
								</div>
								<div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
									<span style={{ fontWeight: 600, fontSize: "0.84rem" }}>
										Halaman {users.meta.currentPage} dari {users.meta.lastPage}
									</span>
									<button
										type="button"
										className="btn btn-ghost"
										style={{ padding: "0.3rem 0.65rem", fontSize: "0.82rem" }}
										disabled={users.meta.currentPage <= 1}
										onClick={() =>
											router.get(
												"/admin",
												{
													userSearch: userSearchKeyword,
													userRole: userRoleFilter,
													userPage: users.meta.currentPage - 1,
												},
												{ preserveState: true, preserveScroll: true },
											)
										}
									>
										&laquo; Sebelum
									</button>
									<button
										type="button"
										className="btn btn-ghost"
										style={{ padding: "0.3rem 0.65rem", fontSize: "0.82rem" }}
										disabled={users.meta.currentPage >= users.meta.lastPage}
										onClick={() =>
											router.get(
												"/admin",
												{
													userSearch: userSearchKeyword,
													userRole: userRoleFilter,
													userPage: users.meta.currentPage + 1,
												},
												{ preserveState: true, preserveScroll: true },
											)
										}
									>
										Berikut &raquo;
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{activeTab === "audit" && (
					/* --- TAB 3: AUDIT LOG & KEAMANAN SISTEM --- */
					<div>
						<div className="security-summary-grid">
							<div className="security-card-item">
								<span className="security-card-title">Enkripsi Identitas</span>
								<span className="security-card-val">AES-256-GCM Active</span>
								<span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
									Data identitas pelapor terisolasi & tersandi
								</span>
							</div>

							<div className="security-card-item">
								<span className="security-card-title">State Machine Enforcement</span>
								<span className="security-card-val">Guard Validated</span>
								<span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
									Mencegah loncatan status tidak sah
								</span>
							</div>

							<div className="security-card-item">
								<span className="security-card-title">Pencatatan Akses</span>
								<span className="security-card-val">Audit Trail Append-Only</span>
								<span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
									Setiap buka identitas dicatat dengan alasan
								</span>
							</div>
						</div>

						<div className="triage-table-card">
							{/* Audit Log Search Control Bar */}
							<form
								onSubmit={handleAuditSearchSubmit}
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									gap: "1rem",
									padding: "1rem 1.25rem",
									borderBottom: "1px solid var(--border)",
									flexWrap: "wrap",
								}}
							>
								<div style={{ display: "flex", gap: "0.75rem", flex: 1, minWidth: "260px", flexWrap: "wrap" }}>
									<div className="form-group" style={{ flex: 1, margin: 0, minWidth: "220px" }}>
										<input
											type="text"
											className="form-input"
											placeholder="🔍 Cari petugas, jenis aksi, nomor tiket target, IP, atau detail..."
											value={auditSearchKeyword}
											onChange={(e) => setAuditSearchKeyword(e.target.value)}
										/>
									</div>
									<button type="submit" className="btn btn-primary">
										Cari Audit Log
									</button>
									{auditSearchKeyword && (
										<button
											type="button"
											className="btn btn-ghost"
											onClick={() => {
												setAuditSearchKeyword("");
												router.get("/admin", { auditPage: 1 }, { preserveState: true, preserveScroll: true });
											}}
										>
											Reset
										</button>
									)}
								</div>
							</form>

							<div className="table-wrap">
								<table className="triage-table audit-table">
									<thead>
										<tr>
											<th>Waktu (UTC/WIB)</th>
											<th>Aktor / Petugas</th>
											<th>Aksi Aktivitas</th>
											<th>Target</th>
											<th>IP Address</th>
											<th>Detail Aktivitas</th>
										</tr>
									</thead>
									<tbody>
										{auditLogsData.map((log) => (
											<tr key={log.id}>
												<td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
													{formatDateTime(log.createdAt || log.timestamp)}
												</td>
												<td style={{ fontWeight: 700 }}>{log.actorName}</td>
												<td className="audit-action-cell">{log.action}</td>
												<td className="ticket-cell">{log.target}</td>
												<td className="audit-ip-cell">{log.ipAddress}</td>
												<td style={{ fontSize: "0.86rem", color: "var(--text)" }}>{log.detail}</td>
											</tr>
										))}

										{auditLogsData.length === 0 && (
											<tr>
												<td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
													Belum ada catatan audit log yang sesuai pencarian.
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>

							{/* Audit Log Pagination Bar */}
							{auditLogsMeta && (
								<div
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										padding: "1rem 1.25rem",
										borderTop: "1px solid var(--border)",
										fontSize: "0.86rem",
										color: "var(--muted)",
										flexWrap: "wrap",
										gap: "0.75rem",
									}}
								>
									<div>
										Menampilkan {auditLogsData.length > 0 ? (auditLogsMeta.currentPage - 1) * auditLogsMeta.perPage + 1 : 0}{" "}
										sampai {Math.min(auditLogsMeta.currentPage * auditLogsMeta.perPage, auditLogsMeta.total)} dari{" "}
										<strong>{auditLogsMeta.total}</strong> Log Aktivitas Auditor
									</div>
									<div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
										<span style={{ fontWeight: 600, fontSize: "0.84rem" }}>
											Halaman {auditLogsMeta.currentPage} dari {auditLogsMeta.lastPage}
										</span>
										<button
											type="button"
											className="btn btn-ghost"
											style={{ padding: "0.3rem 0.65rem", fontSize: "0.82rem" }}
											disabled={auditLogsMeta.currentPage <= 1}
											onClick={() =>
												router.get(
													"/admin",
													{
														auditSearch: auditSearchKeyword,
														auditPage: auditLogsMeta.currentPage - 1,
													},
													{ preserveState: true, preserveScroll: true },
												)
											}
										>
											&laquo; Sebelum
										</button>
										<button
											type="button"
											className="btn btn-ghost"
											style={{ padding: "0.3rem 0.65rem", fontSize: "0.82rem" }}
											disabled={auditLogsMeta.currentPage >= auditLogsMeta.lastPage}
											onClick={() =>
												router.get(
													"/admin",
													{
														auditSearch: auditSearchKeyword,
														auditPage: auditLogsMeta.currentPage + 1,
													},
													{ preserveState: true, preserveScroll: true },
												)
											}
										>
											Berikut &raquo;
										</button>
									</div>
								</div>
							)}
						</div>
					</div>
				)}

				{activeTab === "settings" && userRole === "admin" && (
					/* --- TAB 4: PENGATURAN INSTANSI & MASTER DATA (F09) --- */
					<div className="settings-grid">
						{/* Card 0: Kop Surat & Lembar Pengesahan Dua Kolom */}
						<div className="settings-card" style={{ gridColumn: "1 / -1" }}>
							<div className="settings-card-head">
								<h2 className="settings-card-title">📜 Pengaturan Kop Surat & Lembar Pengesahan Cetak PDF</h2>
							</div>
							<p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: "0 0 1rem" }}>
								Atur identitas instansi pada Kop Surat resmi dan lembar pengesahan tanda tangan dua kolom yang berlaku di seluruh cetakan PDF Resume Kasus dan Laporan Agregat.
							</p>

							{settingsSuccessMsg && (
								<div className="notice notice-success" style={{ marginBottom: "1rem" }}>
									{settingsSuccessMsg}
								</div>
							)}

							<form onSubmit={handleSaveKopAndSignatureSettings} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
								<div>
									<h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem", color: "var(--primary)" }}>
										🏛️ Identitas Kop Surat Dokumen Resmi
									</h3>
									<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
										<div className="form-group">
											<label className="form-label" htmlFor="kopUtama">Baris 1: Instansi Utama / Kementerian</label>
											<input
												id="kopUtama"
												type="text"
												className="form-input"
												value={kopInstansiUtama}
												onChange={(e) => setKopInstansiUtama(e.target.value)}
												required
											/>
										</div>
										<div className="form-group">
											<label className="form-label" htmlFor="kopDaerah">Baris 2: Kantor Wilayah / Daerah</label>
											<input
												id="kopDaerah"
												type="text"
												className="form-input"
												value={kopInstansiDaerah}
												onChange={(e) => setKopInstansiDaerah(e.target.value)}
												required
											/>
										</div>
										<div className="form-group">
											<label className="form-label" htmlFor="kopMadrasah">Baris 3: Nama Madrasah / Satuan Kerja</label>
											<input
												id="kopMadrasah"
												type="text"
												className="form-input"
												value={kopNamaMadrasah}
												onChange={(e) => setKopNamaMadrasah(e.target.value)}
												required
											/>
										</div>
										<div className="form-group">
											<label className="form-label" htmlFor="kopAlamat">Baris 4: Alamat Lengkap & Kontak</label>
											<input
												id="kopAlamat"
												type="text"
												className="form-input"
												value={kopAlamatLengkap}
												onChange={(e) => setKopAlamatLengkap(e.target.value)}
												required
											/>
										</div>
									</div>
								</div>

								<div style={{ borderTop: "1px dashed var(--border)", paddingTop: "1rem" }}>
									<h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0 0 0.75rem", color: "var(--primary)" }}>
										✍️ Lembar Pengesahan Dua Kolom (Tanda Tangan PDF)
									</h3>
									<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
										{/* Kolom Kiri: Pejabat Menyetujui */}
										<div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "1rem" }}>
											<h4 style={{ fontSize: "0.88rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
												📌 Kolom Kiri (Pejabat Mengetahui / Menyetujui)
											</h4>
											<div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
												<div className="form-group">
													<label className="form-label" htmlFor="sigLeftTitle">Judul Pengantar</label>
													<input id="sigLeftTitle" type="text" className="form-input" value={sigLeftTitle} onChange={(e) => setSigLeftTitle(e.target.value)} required />
												</div>
												<div className="form-group">
													<label className="form-label" htmlFor="sigLeftJabatan">Jabatan Pejabat</label>
													<input id="sigLeftJabatan" type="text" className="form-input" value={sigLeftJabatan} onChange={(e) => setSigLeftJabatan(e.target.value)} required />
												</div>
												<div className="form-group">
													<label className="form-label" htmlFor="sigLeftNama">Nama Lengkap & Gelar Pejabat</label>
													<input id="sigLeftNama" type="text" className="form-input" value={sigLeftNama} onChange={(e) => setSigLeftNama(e.target.value)} required />
												</div>
												<div className="form-group">
													<label className="form-label" htmlFor="sigLeftNip">NIP / Nomor Identitas Pejabat</label>
													<input id="sigLeftNip" type="text" className="form-input" value={sigLeftNip} onChange={(e) => setSigLeftNip(e.target.value)} required />
												</div>
											</div>
										</div>

										{/* Kolom Kanan: Petugas Penanggung Jawab */}
										<div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "10px", padding: "1rem" }}>
											<h4 style={{ fontSize: "0.88rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
												📌 Kolom Kanan (Petugas Triase / Administrator)
											</h4>
											<div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
												<div className="form-group">
													<label className="form-label" htmlFor="sigRightKota">Kota Tempat Penandatanganan</label>
													<input id="sigRightKota" type="text" className="form-input" value={sigRightKota} onChange={(e) => setSigRightKota(e.target.value)} required />
												</div>
												<div className="form-group">
													<label className="form-label" htmlFor="sigRightJabatan">Jabatan / Peran Petugas</label>
													<input id="sigRightJabatan" type="text" className="form-input" value={sigRightJabatan} onChange={(e) => setSigRightJabatan(e.target.value)} required />
												</div>
											</div>
										</div>
									</div>
								</div>

								<button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={savingSettings}>
									{savingSettings ? "Menyimpan..." : "💾 Simpan Pengaturan Kop Surat & Lembar Pengesahan"}
								</button>
							</form>
						</div>

						{/* Card 1: Identitas & Parameter Retensi */}
						<div className="settings-card">
							<div className="settings-card-head">
								<h2 className="settings-card-title">1. Identitas & Parameter Retensi System</h2>
							</div>
							<form
								onSubmit={async (e) => {
									e.preventDefault();
									await fetch("/admin/settings", {
										method: "POST",
										headers: { "content-type": "application/json" },
										body: JSON.stringify({
											instansi_name: instansiName,
											instansi_email: instansiEmail,
											retention_days: String(retentionDays),
											max_upload_mb: String(maxUploadMb),
										}),
									});
									alert("Pengaturan parameter sistem berhasil disimpan!");
								}}
								style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
							>
								<div className="form-group">
									<label className="form-label" htmlFor="instansiName">Nama Madrasah</label>
									<input id="instansiName" type="text" className="form-input" value={instansiName} onChange={(e) => setInstansiName(e.target.value)} required />
								</div>
								<div className="form-group">
									<label className="form-label" htmlFor="instansiEmail">Email Layanan Pelaporan</label>
									<input id="instansiEmail" type="email" className="form-input" value={instansiEmail} onChange={(e) => setInstansiEmail(e.target.value)} required />
								</div>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
									<div className="form-group">
										<label className="form-label" htmlFor="retentionDays">Kebijakan Retensi Data (Hari)</label>
										<input id="retentionDays" type="number" className="form-input" value={retentionDays} onChange={(e) => setRetentionDays(Number(e.target.value))} min={30} max={3650} required />
									</div>
									<div className="form-group">
										<label className="form-label" htmlFor="maxUploadMb">Batas Ukuran Upload (MB)</label>
										<input id="maxUploadMb" type="number" className="form-input" value={maxUploadMb} onChange={(e) => setMaxUploadMb(Number(e.target.value))} min={1} max={100} required />
									</div>
								</div>
								<button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
									Simpan Parameter Sistem
								</button>
							</form>
						</div>

						{/* Card 2: Master Kategori Laporan */}
						<div className="settings-card">
							<div className="settings-card-head">
								<h2 className="settings-card-title">2. Master Data Kategori Laporan</h2>
							</div>

							<form onSubmit={handleAddCategory} style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1rem" }}>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
									<div className="form-group">
										<label className="form-label" htmlFor="catJenis">Jenis Laporan</label>
										<select id="catJenis" className="form-select" value={newCatJenis} onChange={(e) => setNewCatJenis(e.target.value)}>
											<option value="Whistleblowing">Whistleblowing</option>
											<option value="Pengaduan">Pengaduan</option>
											<option value="Aspirasi">Aspirasi</option>
										</select>
									</div>
									<div className="form-group">
										<label className="form-label" htmlFor="catName">Nama Kategori</label>
										<input id="catName" type="text" className="form-input" placeholder="Nama Kategori Baru" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} required />
									</div>
								</div>
								<button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
									+ Tambah Kategori
								</button>
							</form>

							<div className="table-wrap">
								<table className="triage-table" style={{ fontSize: "0.85rem" }}>
									<thead>
										<tr>
											<th>Jenis</th>
											<th>Nama Kategori</th>
											<th>Aksi</th>
										</tr>
									</thead>
									<tbody>
										{categories.map((cat) => (
											<tr key={cat.id}>
												<td>{cat.jenis}</td>
												<td style={{ fontWeight: 700 }}>{cat.name}</td>
												<td>
													<button type="button" className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }} onClick={() => handleDeleteCategory(cat.id)}>
														Hapus
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>

						{/* Card 3: Master Unit Kerja Disposisi */}
						<div className="settings-card">
							<div className="settings-card-head">
								<h2 className="settings-card-title">3. Master Unit Kerja Disposisi</h2>
							</div>

							<form onSubmit={handleAddUnit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1rem" }}>
								<div className="form-group">
									<label className="form-label" htmlFor="unitNameInput">Nama Unit Disposisi</label>
									<input id="unitNameInput" type="text" className="form-input" placeholder="Contoh: Seksi Keuangan" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} required />
								</div>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
									<div className="form-group">
										<label className="form-label" htmlFor="unitHeadInput">Kepala Unit</label>
										<input id="unitHeadInput" type="text" className="form-input" placeholder="Nama Penanggung Jawab" value={newUnitHead} onChange={(e) => setNewUnitHead(e.target.value)} required />
									</div>
									<div className="form-group">
										<label className="form-label" htmlFor="unitEmailInput">Email Unit</label>
										<input id="unitEmailInput" type="email" className="form-input" placeholder="unit@mtsn3.sch.id" value={newUnitEmail} onChange={(e) => setNewUnitEmail(e.target.value)} required />
									</div>
								</div>
								<button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
									+ Tambah Unit Kerja
								</button>
							</form>

							<div className="table-wrap">
								<table className="triage-table" style={{ fontSize: "0.85rem" }}>
									<thead>
										<tr>
											<th>Nama Unit</th>
											<th>Kepala Unit</th>
											<th>Email</th>
											<th>Aksi</th>
										</tr>
									</thead>
									<tbody>
										{units.map((un) => (
											<tr key={un.id}>
												<td style={{ fontWeight: 700 }}>{un.name}</td>
												<td>{un.headName}</td>
												<td>{un.email}</td>
												<td>
													<button type="button" className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }} onClick={() => handleDeleteUnit(un.id)}>
														Hapus
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>

						{/* Card 4: Master Hari Libur & Kalender */}
						<div className="settings-card">
							<div className="settings-card-head">
								<h2 className="settings-card-title">4. Master Hari Libur Nasional & Kalender</h2>
							</div>

							<form onSubmit={handleAddHoliday} style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1rem" }}>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
									<div className="form-group">
										<label className="form-label" htmlFor="holDate">Tanggal (YYYY-MM-DD)</label>
										<input id="holDate" type="date" className="form-input" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} required />
									</div>
									<div className="form-group">
										<label className="form-label" htmlFor="holTitle">Keterangan Hari Libur</label>
										<input id="holTitle" type="text" className="form-input" placeholder="HUT RI / Idul Fitri" value={newHolidayTitle} onChange={(e) => setNewHolidayTitle(e.target.value)} required />
									</div>
								</div>
								<button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
									+ Tambah Hari Libur
								</button>
							</form>

							<div className="table-wrap">
								<table className="triage-table" style={{ fontSize: "0.85rem" }}>
									<thead>
										<tr>
											<th>Tanggal</th>
											<th>Keterangan</th>
											<th>Aksi</th>
										</tr>
									</thead>
									<tbody>
										{holidays.map((h) => (
											<tr key={h.id}>
												<td>{h.holidayDate}</td>
												<td style={{ fontWeight: 600 }}>{h.title}</td>
												<td>
													<button type="button" className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }} onClick={() => handleDeleteHoliday(h.id)}>
														Hapus
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>

						{/* Card 5: Master FAQ Publik */}
						<div className="settings-card" style={{ gridColumn: "1 / -1" }}>
							<div className="settings-card-head">
								<h2 className="settings-card-title">5. Master FAQ Publik (Tanya Jawab Pelapor)</h2>
							</div>

							<form onSubmit={handleAddFaq} style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1rem" }}>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.85rem" }}>
									<div className="form-group">
										<label className="form-label" htmlFor="faqCategory">Kategori FAQ</label>
										<input id="faqCategory" type="text" className="form-input" placeholder="Umum / Keamanan / SLA" value={newFaqCategory} onChange={(e) => setNewFaqCategory(e.target.value)} required />
									</div>
									<div className="form-group">
										<label className="form-label" htmlFor="faqQuestion">Pertanyaan FAQ</label>
										<input id="faqQuestion" type="text" className="form-input" placeholder="Apakah identitas dijamin rahasia?" value={newFaqQuestion} onChange={(e) => setNewFaqQuestion(e.target.value)} required />
									</div>
								</div>
								<div className="form-group">
									<label className="form-label" htmlFor="faqAnswer">Jawaban FAQ</label>
									<textarea id="faqAnswer" className="form-textarea" placeholder="Tuliskan jawaban yang ramah dan rinci..." value={newFaqAnswer} onChange={(e) => setNewFaqAnswer(e.target.value)} rows={2} required />
								</div>
								<button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
									+ Tambah FAQ
								</button>
							</form>

							<div className="table-wrap">
								<table className="triage-table" style={{ fontSize: "0.85rem" }}>
									<thead>
										<tr>
											<th>Kategori</th>
											<th>Pertanyaan</th>
											<th>Jawaban</th>
											<th>Aksi</th>
										</tr>
									</thead>
									<tbody>
										{faqs.map((f) => (
											<tr key={f.id}>
												<td>{f.category}</td>
												<td style={{ fontWeight: 700 }}>{f.question}</td>
												<td>{f.answer}</td>
												<td>
													<button type="button" className="btn btn-ghost" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }} onClick={() => handleDeleteFaq(f.id)}>
														Hapus
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				)}
					</main>
				</div>

				{/* Identity Access Modal */}
				{showIdentityModal && (
					<div className="modal-center-overlay" onClick={() => setShowIdentityModal(false)}>
						<div className="modal-box" onClick={(e) => e.stopPropagation()}>
							<h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 1rem" }}>
								🔓 Akses Identitas Pelapor (RBAC)
							</h2>
							<p style={{ fontSize: "0.88rem", color: "var(--muted)", marginBottom: "1rem" }}>
								Sesuai kebijakan keamanan whistleblower, pembukaan data identitas pelapor wajib mencantumkan alasan yang akan dicatat permanen pada audit trail.
							</p>

							{identityError && (
								<div className="notice notice-error" style={{ marginBottom: "1rem" }}>
									{identityError}
								</div>
							)}

							<form onSubmit={handleAccessIdentitySubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
								<div className="form-group">
									<label className="form-label" htmlFor="identReason">Alasan Membuka Identitas (Min 10 karakter)</label>
									<textarea
										key={showIdentityModal ? "identity-modal-open" : "identity-modal-closed"}
										id="identReason"
										name="identReason"
										className="form-textarea"
										placeholder="Diperlukan untuk konfirmasi bukti dugaan pelanggaran internal..."
										defaultValue=""
										onChange={(e) => setIdentityReason(e.target.value)}
										rows={3}
										minLength={10}
										required
									/>
									<div style={{ fontSize: "0.78rem", color: identityReason.trim().length >= 10 ? "var(--muted)" : "var(--danger)", marginTop: "0.25rem", textAlign: "right" }}>
										{identityReason.trim().length} / 10 karakter minimum
									</div>
								</div>

								<div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
									<button type="button" className="btn btn-ghost" onClick={() => setShowIdentityModal(false)}>
										Batal
									</button>
									<button type="submit" className="btn btn-primary">
										Buka & Dekripsi Identitas
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* Generic Action Modal (Forward, Reject, Duplicate, Close, Reopen) */}
				{actionModalType && (
					<div className="modal-center-overlay" onClick={() => setActionModalType(null)}>
						<div className="modal-box" onClick={(e) => e.stopPropagation()}>
							<h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 1rem", textTransform: "capitalize" }}>
								{actionModalType === "forward" && "↗️ Dialihkan / Transferred Ke Unit"}
								{actionModalType === "reject" && "🚫 Penolakan Laporan"}
								{actionModalType === "duplicate" && "🔗 Tandai Laporan Duplikat"}
								{actionModalType === "close" && "✅ Penutupan Kasus & Ringkasan Hasil"}
								{actionModalType === "reopen" && "🔄 Pembukaan Kembali Kasus"}
							</h2>

							{actionError && (
								<div className="notice notice-error" style={{ marginBottom: "1rem" }}>
									{actionError}
								</div>
							)}

							<form onSubmit={handleActionModalSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
								{actionModalType === "forward" && (
									<div className="form-group">
										<label className="form-label" htmlFor="forwardUnit">Unit / Instansi Tujuan</label>
										<input
											id="forwardUnit"
											type="text"
											className="form-input"
											placeholder="Misal: Inspektorat Jenderal Kemenag"
											value={actionExtraInput}
											onChange={(e) => setActionExtraInput(e.target.value)}
											required
										/>
									</div>
								)}

								{actionModalType === "duplicate" && (
									<div className="form-group">
										<label className="form-label" htmlFor="duplicateTicket">Nomor Tiket Utama Acuan</label>
										<input
											id="duplicateTicket"
											type="text"
											className="form-input"
											placeholder="LPR-202608-XXXXXX"
											value={actionExtraInput}
											onChange={(e) => setActionExtraInput(e.target.value)}
											required
										/>
									</div>
								)}

								<div className="form-group">
									<label className="form-label" htmlFor="actionReason">
										{actionModalType === "close" ? "Ringkasan Hasil Penanganan & Keputusan" : "Alasan Wajib (Min 10 Karakter)"}
									</label>
									<textarea
										id="actionReason"
										className="form-textarea"
										placeholder="Jelaskan alasan atau ringkasan hasil secara rinci..."
										value={actionReason}
										onChange={(e) => setActionReason(e.target.value)}
										rows={3}
										required
									/>
								</div>

								<div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
									<button type="button" className="btn btn-ghost" onClick={() => setActionModalType(null)}>
										Batal
									</button>
									<button type="submit" className="btn btn-primary" disabled={submittingAction}>
										{submittingAction ? "Memproses..." : "Konfirmasi & Simpan"}
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* Modal: Tambah Pengguna / Petugas Baru */}
				{showCreateUserModal && (
					<div className="modal-center-overlay" onClick={() => setShowCreateUserModal(false)}>
						<div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "520px" }}>
							<h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 0.5rem" }}>
								➕ Tambah Pengguna / Petugas Baru
							</h2>
							<p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 1.25rem" }}>
								Buat akun pengguna baru dan tentukan hak akses perannya dalam sistem.
							</p>

							{userActionError && (
								<div className="notice notice-error" style={{ marginBottom: "1rem" }}>
									{userActionError}
								</div>
							)}

							<form onSubmit={handleCreateUserSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
								<div className="form-group">
									<label className="form-label" htmlFor="newUserName">Nama Lengkap</label>
									<input
										id="newUserName"
										type="text"
										className="form-input"
										placeholder="Misal: Ahmad Fauzi, S.Pd."
										value={newUserName}
										onChange={(e) => setNewUserName(e.target.value)}
										required
									/>
								</div>

								<div className="form-group">
									<label className="form-label" htmlFor="newUserEmail">Alamat Email</label>
									<input
										id="newUserEmail"
										type="email"
										className="form-input"
										placeholder="ahmad@mtsn3padang.sch.id"
										value={newUserEmail}
										onChange={(e) => setNewUserEmail(e.target.value)}
										required
									/>
								</div>

								<div className="form-group">
									<label className="form-label" htmlFor="newUserPassword">Kata Sandi (Min 6 Karakter)</label>
									<input
										id="newUserPassword"
										type="password"
										className="form-input"
										placeholder="••••••••"
										value={newUserPassword}
										onChange={(e) => setNewUserPassword(e.target.value)}
										minLength={6}
										required
									/>
								</div>

								<div className="form-group">
									<label className="form-label" htmlFor="newUserRole">Peran & Hak Akses System</label>
									<select
										id="newUserRole"
										className="form-select"
										value={newUserRole}
										onChange={(e) => setNewUserRole(e.target.value as Role)}
									>
										<option value="petugas_triase">📋 Petugas Triase (Verifikasi & Disposisi)</option>
										<option value="penindak_lanjut">🛠️ Penindak Lanjut (Tim Unit/Seksi)</option>
										<option value="admin">⚙️ Admin (Pengelola Sistem Lengkap)</option>
										<option value="pimpinan">📊 Pimpinan (Monitoring & Dasbor)</option>
										<option value="user">👤 Pelapor (User Publik)</option>
									</select>
								</div>

								<div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
									<button type="button" className="btn btn-ghost" onClick={() => setShowCreateUserModal(false)}>
										Batal
									</button>
									<button type="submit" className="btn btn-primary" disabled={submittingUserAction}>
										{submittingUserAction ? "Menyimpan..." : "Simpan Akun Baru"}
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* Modal: Ubah Peran / Hak Akses Pengguna */}
				{selectedUserForEdit && (
					<div className="modal-center-overlay" onClick={() => setSelectedUserForEdit(null)}>
						<div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
							<h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 0.5rem" }}>
								✏️ Ubah Peran & Hak Akses Pengguna
							</h2>
							<p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "0 0 1.25rem" }}>
								Mengubah wewenang akses untuk akun <strong>{selectedUserForEdit.name}</strong> ({selectedUserForEdit.email}).
							</p>

							{userActionError && (
								<div className="notice notice-error" style={{ marginBottom: "1rem" }}>
									{userActionError}
								</div>
							)}

							<form onSubmit={handleEditRoleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
								<div className="form-group">
									<label className="form-label" htmlFor="editUserRole">Pilih Peran Baru</label>
									<select
										id="editUserRole"
										className="form-select"
										value={editUserRole}
										onChange={(e) => setEditUserRole(e.target.value as Role)}
									>
										<option value="admin">⚙️ Admin (Pengelola Sistem Lengkap)</option>
										<option value="petugas_triase">📋 Petugas Triase (Verifikasi & Disposisi)</option>
										<option value="penindak_lanjut">🛠️ Penindak Lanjut (Tim Unit/Seksi)</option>
										<option value="pimpinan">📊 Pimpinan (Monitoring & Dasbor)</option>
										<option value="user">👤 Pelapor (User Publik)</option>
									</select>
								</div>

								<div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
									<button type="button" className="btn btn-ghost" onClick={() => setSelectedUserForEdit(null)}>
										Batal
									</button>
									<button type="submit" className="btn btn-primary" disabled={submittingUserAction}>
										{submittingUserAction ? "Memproses..." : "Simpan Perubahan Peran"}
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{/* Modal: Hapus Akun Pengguna */}
				{selectedUserForDelete && (
					<div className="modal-center-overlay" onClick={() => setSelectedUserForDelete(null)}>
						<div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
							<h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 0.5rem", color: "var(--danger)" }}>
								🗑️ Hapus Akun Pengguna
							</h2>
							<p style={{ fontSize: "0.9rem", margin: "0 0 1rem" }}>
								Apakah Anda yakin ingin menghapus akun <strong>{selectedUserForDelete.name}</strong> ({selectedUserForDelete.email})?
							</p>

							{userActionError && (
								<div className="notice notice-error" style={{ marginBottom: "1rem" }}>
									{userActionError}
								</div>
							)}

							<form onSubmit={handleDeleteUserSubmit} style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
								<button type="button" className="btn btn-ghost" onClick={() => setSelectedUserForDelete(null)}>
									Batal
								</button>
								<button type="submit" className="btn btn-danger" disabled={submittingUserAction}>
									{submittingUserAction ? "Menghapus..." : "Ya, Hapus Akun"}
								</button>
							</form>
						</div>
					</div>
				)}

				{/* Modal Case Detail Drawer (6 Tabs) */}
				{selectedReportId && reportDetail && (
					<div
						className="modal-overlay"
						onClick={() => {
							// Jangan tutup drawer jika modal identity atau action sedang terbuka
							if (showIdentityModal || actionModalType) return;
							setSelectedReportId(null);
						}}
					>
						<div className="triage-drawer" onClick={(e) => e.stopPropagation()}>
							<div className="drawer-header">
								<div>
									<span className="ticket-cell" style={{ fontSize: "1.1rem" }}>
										{reportDetail.report.ticketNumber}
									</span>
									<h2 className="drawer-title">{reportDetail.report.judul}</h2>
								</div>
								<button
									type="button"
									className="btn btn-ghost"
									onClick={() => setSelectedReportId(null)}
									style={{ padding: "0.4rem 0.6rem" }}
								>
									✕
								</button>
							</div>

							{/* Drawer Sub-Tabs (6 Tabs) */}
							<div className="drawer-tabs-bar">
								<button
									type="button"
									className={`drawer-tab-btn ${detailTab === "summary" ? "drawer-tab-active" : ""}`}
									onClick={() => setDetailTab("summary")}
								>
									📌 Ringkasan & Triase
								</button>
								<button
									type="button"
									className={`drawer-tab-btn ${detailTab === "attachments" ? "drawer-tab-active" : ""}`}
									onClick={() => setDetailTab("attachments")}
								>
									📎 Bukti ({reportDetail.attachments.length})
								</button>
								<button
									type="button"
									className={`drawer-tab-btn ${detailTab === "messages" ? "drawer-tab-active" : ""}`}
									onClick={() => setDetailTab("messages")}
								>
									💬 Pesan Pelapor ({reportDetail.messages.filter((m) => !m.isInternalNote).length})
								</button>
								<button
									type="button"
									className={`drawer-tab-btn ${detailTab === "notes" ? "drawer-tab-active" : ""}`}
									onClick={() => setDetailTab("notes")}
								>
									📝 Catatan Internal ({reportDetail.messages.filter((m) => m.isInternalNote).length})
								</button>
								<button
									type="button"
									className={`drawer-tab-btn ${detailTab === "actions" ? "drawer-tab-active" : ""}`}
									onClick={() => setDetailTab("actions")}
								>
									☑️ Checklist Tindakan ({reportDetail.caseActions.length})
								</button>
								<button
									type="button"
									className={`drawer-tab-btn ${detailTab === "history" ? "drawer-tab-active" : ""}`}
									onClick={() => setDetailTab("history")}
								>
									📜 Audit & Linimasa
								</button>
							</div>

							<div className="drawer-body">
								{detailTab === "summary" && (
									<>
										{/* Report Metadata Summary */}
										<div className="drawer-info-grid">
											<div>
												<span className="drawer-meta-label">Jenis & Kategori</span>
												<div style={{ fontWeight: 700 }}>{reportDetail.report.jenis} • {reportDetail.report.kategori}</div>
											</div>
											<div>
												<span className="drawer-meta-label">Status Terkini</span>
												<div>
													<span className={`badge-status badge-st-${(reportDetail.report.detailedStatus || reportDetail.report.status).toLowerCase().replace(/\s+/g, "-")}`}>
														● {reportDetail.report.detailedStatus || reportDetail.report.status}
													</span>
												</div>
											</div>
											<div>
												<span className="drawer-meta-label">Prioritas Laporan</span>
												<div>
													<span className={`badge-priority badge-p-${(reportDetail.report.priority || "Sedang").toLowerCase()}`}>
														● {reportDetail.report.priority || "Sedang"}
													</span>
												</div>
											</div>
											<div>
												<span className="drawer-meta-label">Unit Disposisi</span>
												<div style={{ fontWeight: 700, color: "var(--primary)" }}>{reportDetail.report.unitDisposisi}</div>
											</div>
											<div>
												<span className="drawer-meta-label">Waktu Kejadian & Lokasi</span>
												<div style={{ fontSize: "0.88rem" }}>
													{reportDetail.report.tanggalKejadian || "-"} di {reportDetail.report.lokasiKejadian || "-"}
												</div>
											</div>
											<div>
												<span className="drawer-meta-label">Target SLA Penyelesaian</span>
												<div style={{ fontSize: "0.88rem", fontWeight: 700 }}>
													{reportDetail.report.slaTarget || "TBD"}
												</div>
											</div>
										</div>

										{/* Kronologi Kejadian */}
										<div>
											<div className="drawer-section-title">Kronologi & Uraian Kejadian</div>
											<div className="kronologi-box">{reportDetail.report.kronologi}</div>
										</div>

										{/* Reporter Identity Protection */}
										<div>
											<div className="drawer-section-title">Informasi & Perlindungan Identitas Pelapor</div>
											{isReportAnonymous(reportDetail.report.isAnonymous) ? (
												<div className="identity-panel identity-anonymous">
													🔒 <strong>Pelapor Anonim:</strong> Identitas tidak dikumpulkan oleh sistem sesuai opsi kerahasiaan whistleblower.
												</div>
											) : (
												<div className="identity-panel identity-identified">
													{unencryptedIdentity ? (
														<div>
															<div style={{ fontWeight: 800, color: "var(--primary)", marginBottom: "0.4rem" }}>
																✅ Identitas Pelapor Berhasil Didekripsi:
															</div>
															<div><strong>Nama:</strong> {unencryptedIdentity.name || "-"}</div>
															<div><strong>Email:</strong> {unencryptedIdentity.email || "-"}</div>
															<div><strong>No. HP/WA:</strong> {unencryptedIdentity.phone || "-"}</div>
														</div>
													) : (
														<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
															<div>
																👤 <strong>Pelapor Teridentifikasi:</strong> Data disamarkan secara default untuk melindungi privasi.
															</div>
															{!isReadOnly && (userRole === "admin" || userRole === "petugas_triase") && (
																<button
																	type="button"
																	className="btn btn-ghost"
																	style={{ fontSize: "0.8rem" }}
																	onClick={() => setShowIdentityModal(true)}
																>
																	🔓 Buka Identitas
																</button>
															)}
														</div>
													)}
												</div>
											)}
										</div>

										{/* Quick Operations Bar (Triase, Assign, Status Action Buttons) */}
										{!isReadOnly && (
											<div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.25rem" }}>
												<div className="drawer-section-title" style={{ marginTop: 0 }}>Operasi & Tindakan Penanganan Kasus</div>

												{/* Form Triase & Disposisi */}
												{(userRole === "admin" || userRole === "petugas_triase") && (
													<form onSubmit={handleTriaseSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.25rem" }}>
														<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
															<div className="form-group">
																<label className="form-label" htmlFor="priorityFormSelect">Prioritas Laporan</label>
																<select
																	id="priorityFormSelect"
																	className="form-select"
																	value={priorityForm}
																	onChange={(e) => setPriorityForm(e.target.value)}
																>
																	<option value="Kritis">Kritis (Respon &le; 2 Jam)</option>
																	<option value="Tinggi">Tinggi (Respon &le; 1 Hari)</option>
																	<option value="Sedang">Sedang (Respon &le; 2 Hari)</option>
																	<option value="Rendah">Rendah (Respon &le; 3 Hari)</option>
																</select>
															</div>
															<div className="form-group">
																<label className="form-label" htmlFor="unitFormSelect">Unit Disposisi Penanggung Jawab</label>
																<select
																	id="unitFormSelect"
																	className="form-select"
																	value={unitForm}
																	onChange={(e) => setUnitForm(e.target.value)}
																>
																	<option value="Tim Investigasi Internal">Tim Investigasi Internal</option>
																	<option value="Seksi Layanan Sarpras">Seksi Layanan Sarpras</option>
																	<option value="Seksi Kesiswaan & Kurikulum">Seksi Kesiswaan & Kurikulum</option>
																	<option value="Subbagian Tata Usaha">Subbagian Tata Usaha</option>
																	<option value="Kepala Madrasah">Kepala Madrasah</option>
																</select>
															</div>
														</div>
														<button type="submit" className="btn btn-primary">
															Simpan Triase & Disposisi Unit
														</button>
													</form>
												)}

												{/* Special Action Buttons Grid */}
												<div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
													{(userRole === "admin" || userRole === "petugas_triase") && (
														<>
															<button type="button" className="btn btn-ghost" onClick={() => setActionModalType("forward")}>
																↗️ Alihkan ke Unit/External
															</button>
															<button type="button" className="btn btn-ghost" onClick={() => setActionModalType("duplicate")}>
																🔗 Tandai Duplikat
															</button>
															<button type="button" className="btn btn-ghost" style={{ color: "var(--danger)" }} onClick={() => setActionModalType("reject")}>
																🚫 Tolak Laporan
															</button>
														</>
													)}

													{(userRole === "admin" || userRole === "petugas_triase" || userRole === "penindak_lanjut") && (
														<button type="button" className="btn btn-primary" onClick={() => setActionModalType("close")}>
															✅ Selesaikan & Tutup Kasus
														</button>
													)}

													{userRole === "admin" && reportDetail.report.detailedStatus === "Ditutup" && (
														<button type="button" className="btn btn-ghost" onClick={() => setActionModalType("reopen")}>
															🔄 Buka Kembali Kasus
														</button>
													)}
												</div>
											</div>
										)}
									</>
								)}

								{detailTab === "attachments" && (
									/* --- TAB 2: ATTACHMENTS --- */
									<div>
										<div className="drawer-section-title">Berkas Lampiran & Bukti Pendukung</div>
										{reportDetail.attachments.length === 0 ? (
											<p style={{ color: "var(--muted)", fontStyle: "italic" }}>Tidak ada berkas lampiran yang diunggah.</p>
										) : (
											<div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
												{reportDetail.attachments.map((att) => (
													<div key={att.id} className="attachment-item-card">
														<div>
															<div style={{ fontWeight: 700 }}>📄 {att.fileName}</div>
															<div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
																{(att.fileSize / 1024).toFixed(1)} KB • {att.mimeType}
															</div>
														</div>
														<a href={`/uploads/${att.uploadId || att.id}`} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ fontSize: "0.8rem" }}>
															⬇️ Unduh Berkas
														</a>
													</div>
												))}
											</div>
										)}
									</div>
								)}

								{detailTab === "messages" && (
									/* --- TAB 3: PUBLIC MESSAGES --- */
									<div>
										<div className="drawer-section-title">Komunikasi Balasan Resmi ke Pelapor</div>
										{reportDetail.messages.filter((m) => !m.isInternalNote).length === 0 ? (
											<p style={{ color: "var(--muted)", fontStyle: "italic", marginBottom: "1rem" }}>Belum ada pesan resmi yang dikirimkan ke pelapor.</p>
										) : (
											reportDetail.messages
												.filter((m) => !m.isInternalNote)
												.map((msg) => (
													<div key={msg.id} className="public-msg-item">
														<div style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--primary)", marginBottom: "0.25rem" }}>
															{msg.senderName} ({msg.senderType}) • {formatDateTime(msg.createdAt)}
														</div>
														<div>{msg.content}</div>
													</div>
												))
										)}

										{!isReadOnly && (
											<form onSubmit={handleAddPublicMsg} style={{ marginTop: "1rem" }}>
												<div className="form-group">
													<label className="form-label" htmlFor="publicMsgText">Kirim Pesan Resmi ke Portal Pelacakan Pelapor</label>
													<textarea
														id="publicMsgText"
														className="form-textarea"
														placeholder="Tuliskan balasan, perkembangan kasus, atau permintaan klarifikasi tambahan..."
														value={newPublicMsg}
														onChange={(e) => setNewPublicMsg(e.target.value)}
														rows={3}
														required
													/>
												</div>
												<button type="submit" className="btn btn-primary" style={{ marginTop: "0.5rem" }}>
													Kirim Pesan Resmi
												</button>
											</form>
										)}
									</div>
								)}

								{detailTab === "notes" && (
									/* --- TAB 4: INTERNAL NOTES --- */
									<div>
										<div className="drawer-section-title">Catatan Internal Petugas (Rahasia)</div>
										{reportDetail.messages.filter((m) => m.isInternalNote).length === 0 ? (
											<p style={{ color: "var(--muted)", fontStyle: "italic", marginBottom: "1rem" }}>Belum ada catatan internal petugas.</p>
										) : (
											reportDetail.messages
												.filter((m) => m.isInternalNote)
												.map((note) => (
													<div key={note.id} className="internal-note-item">
														<div className="internal-note-author">
															{note.senderName} • {formatDateTime(note.createdAt)}
														</div>
														<div>{note.content}</div>
													</div>
												))
										)}

										{!isReadOnly && (
											<form onSubmit={handleAddInternalNote} style={{ marginTop: "1rem" }}>
												<div className="form-group">
													<label className="form-label" htmlFor="internalNoteText">Tambah Catatan Internal Kasus</label>
													<textarea
														id="internalNoteText"
														className="form-textarea"
														placeholder="Tuliskan catatan internal teknis yang hanya dapat dibaca oleh sesama petugas..."
														value={newInternalNote}
														onChange={(e) => setNewInternalNote(e.target.value)}
														rows={3}
														required
													/>
												</div>
												<button type="submit" className="btn btn-ghost" style={{ marginTop: "0.5rem" }}>
													+ Tambah Catatan Internal
												</button>
											</form>
										)}
									</div>
								)}

								{detailTab === "actions" && (
									/* --- TAB 5: CHECKLIST CASE ACTIONS --- */
									<div>
										<div className="drawer-section-title">Checklist Tindakan & Langkah Penanganan</div>
										{reportDetail.caseActions.length === 0 ? (
											<p style={{ color: "var(--muted)", fontStyle: "italic", marginBottom: "1rem" }}>Belum ada item checklist tindakan untuk kasus ini.</p>
										) : (
											<div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
												{reportDetail.caseActions.map((act) => (
													<div key={act.id} className="action-checklist-row">
														<input
															type="checkbox"
															id={`act-${act.id}`}
															checked={Boolean(act.isCompleted)}
															disabled={isReadOnly}
															onChange={() => handleToggleAction(act.id, act.isCompleted)}
															style={{ width: "18px", height: "18px", cursor: "pointer" }}
														/>
														<label
															htmlFor={`act-${act.id}`}
															style={{
																flex: 1,
																cursor: "pointer",
																textDecoration: act.isCompleted ? "line-through" : "none",
																color: act.isCompleted ? "var(--muted)" : "var(--text)",
																fontWeight: 600,
															}}
														>
															{act.title}
														</label>
														{act.isCompleted ? (
															<span style={{ fontSize: "0.75rem", color: "var(--success)" }}>✅ Selesai ({formatDateTime(act.completedAt)})</span>
														) : null}
													</div>
												))}
											</div>
										)}

										{!isReadOnly && (userRole === "admin" || userRole === "penindak_lanjut") && (
											<form onSubmit={handleAddCaseAction} style={{ display: "flex", gap: "0.5rem" }}>
												<input
													type="text"
													className="form-input"
													placeholder="Tambah item tindakan baru (misal: Panggil saksi pelapor)..."
													value={newActionTitle}
													onChange={(e) => setNewActionTitle(e.target.value)}
													required
												/>
												<button type="submit" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}>
													+ Tambah
												</button>
											</form>
										)}
									</div>
								)}

								{detailTab === "history" && (
									/* --- TAB 6: AUDIT & STATUS HISTORY --- */
									<div>
										<div className="drawer-section-title">Linimasa Perubahan Status Kasus</div>
										<div className="timeline-wrap" style={{ marginBottom: "1.5rem" }}>
											{reportDetail.statusHistory.map((hist) => (
												<div key={hist.id} className="timeline-node">
													<div className="timeline-dot" />
													<div className="timeline-content">
														<div style={{ fontWeight: 700 }}>
															{hist.fromStatus || "Awal"} &rarr; {hist.toStatus}
														</div>
														<div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
															Oleh: {hist.actorName} • {formatDateTime(hist.createdAt)}
														</div>
														{hist.reason && <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>catatan: {hist.reason}</div>}
													</div>
												</div>
											))}
										</div>

										<div className="drawer-section-title">Riwayat Penugasan Unit Disposisi</div>
										{reportDetail.assignments.length === 0 ? (
											<p style={{ color: "var(--muted)", fontStyle: "italic" }}>Belum ada riwayat penugasan.</p>
										) : (
											<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
												{reportDetail.assignments.map((ass) => (
													<div key={ass.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.75rem" }}>
														<div style={{ fontWeight: 700 }}>Disposisi: {ass.unitName}</div>
														<div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Ditugaskan pada: {formatDateTime(ass.createdAt)}</div>
														{ass.notes && <div style={{ fontSize: "0.84rem", marginTop: "0.2rem" }}>Catatan: {ass.notes}</div>}
													</div>
												))}
											</div>
										)}
									</div>
								)}

								{/* Print Button */}
								<div style={{ paddingTop: "1rem", borderTop: "1px solid var(--border)", marginTop: "auto" }}>
									<button type="button" className="btn btn-ghost btn-block" onClick={() => window.print()}>
										🖨️ Cetak Resume Kasus (PDF)
									</button>
								</div>
							</div>
						</div>
					</div>
				)}

				{/* DEDICATED PRINTABLE CASE RESUME DOCUMENT (Rendered directly in document.body via Portal) */}
				{selectedReportId && reportDetail && typeof document !== "undefined" && createPortal(
					<div id="print-section">
						{/* Kop Surat Official Header */}
						<div className="print-kop-header">
							<h3 style={{ margin: 0, fontSize: "11pt", fontWeight: "bold", textTransform: "uppercase" }}>
								{kopInstansiUtama}
							</h3>
							<h4 style={{ margin: "2px 0", fontSize: "10pt", fontWeight: "bold" }}>
								{kopInstansiDaerah}
							</h4>
							<h2 style={{ margin: "4px 0", fontSize: "14pt", fontWeight: "900", color: "#1e3a8a" }}>
								{kopNamaMadrasah}
							</h2>
							<p style={{ margin: 0, fontSize: "8.5pt", color: "#475569" }}>
								{kopAlamatLengkap}
							</p>
						</div>

						<div className="print-double-line" />

						{/* Document Title */}
						<div style={{ textAlign: "center", marginBottom: "15px" }}>
							<h2 style={{ margin: "0 0 4px 0", fontSize: "13pt", fontWeight: "bold", textTransform: "uppercase" }}>
								RESUME & LEMBAR DISPOSISI PENANGANAN LAPORAN
							</h2>
							<p style={{ margin: 0, fontSize: "9.5pt", color: "#475569" }}>
								Nomor Tiket Registrasi: <strong style={{ color: "#000" }}>{reportDetail.report.ticketNumber}</strong>
							</p>
						</div>

						{/* I. Identitas & Rekap Informasi Laporan */}
						<div className="print-section-title">I. INFORMASI UTAMA LAPORAN</div>
						<table className="print-table-grid">
							<tbody>
								<tr>
									<td style={{ width: "22%", fontWeight: "bold", background: "#f8fafc" }}>Nomor Tiket</td>
									<td style={{ width: "28%", fontWeight: "bold" }}>{reportDetail.report.ticketNumber}</td>
									<td style={{ width: "22%", fontWeight: "bold", background: "#f8fafc" }}>Status Terkini</td>
									<td style={{ width: "28%", fontWeight: "bold" }}>{reportDetail.report.detailedStatus || reportDetail.report.status}</td>
								</tr>
								<tr>
									<td style={{ fontWeight: "bold", background: "#f8fafc" }}>Jenis Laporan</td>
									<td>{reportDetail.report.jenis}</td>
									<td style={{ fontWeight: "bold", background: "#f8fafc" }}>Kategori Laporan</td>
									<td>{reportDetail.report.kategori}</td>
								</tr>
								<tr>
									<td style={{ fontWeight: "bold", background: "#f8fafc" }}>Prioritas Kasus</td>
									<td style={{ fontWeight: "bold" }}>{reportDetail.report.priority || "Sedang"}</td>
									<td style={{ fontWeight: "bold", background: "#f8fafc" }}>Unit Disposisi</td>
									<td style={{ fontWeight: "bold", color: "#1e3a8a" }}>{reportDetail.report.unitDisposisi}</td>
								</tr>
								<tr>
									<td style={{ fontWeight: "bold", background: "#f8fafc" }}>Identitas Pelapor</td>
									<td>
										{isReportAnonymous(reportDetail.report.isAnonymous)
											? "Anonim (Dirahasiakan)"
											: unencryptedIdentity
												? `${unencryptedIdentity.name || "Teridentifikasi"} (${unencryptedIdentity.phone || unencryptedIdentity.email || ""})`
												: reportDetail.report.reporterName
													? `${reportDetail.report.reporterName} (${reportDetail.report.reporterPhone || reportDetail.report.reporterEmail || ""})`
													: "Pelapor Teridentifikasi"}
									</td>
									<td style={{ fontWeight: "bold", background: "#f8fafc" }}>Target SLA</td>
									<td>{reportDetail.report.slaTarget || "5 Hari Kerja"}</td>
								</tr>
								<tr>
									<td style={{ fontWeight: "bold", background: "#f8fafc" }}>Waktu Kejadian</td>
									<td>{reportDetail.report.tanggalKejadian || "-"}</td>
									<td style={{ fontWeight: "bold", background: "#f8fafc" }}>Lokasi Kejadian</td>
									<td>{reportDetail.report.lokasiKejadian || "-"}</td>
								</tr>
							</tbody>
						</table>

						{/* II. Judul & Kronologi Kejadian */}
						<div className="print-section-title">II. JUDUL & URAIAN KRONOLOGI KEJADIAN</div>
						<div style={{ marginBottom: "6px", fontWeight: "bold", fontSize: "10.5pt" }}>
							Judul: {reportDetail.report.judul}
						</div>
						<div className="print-box">
							{reportDetail.report.kronologi}
						</div>

						{/* III. Bukti & Lampiran */}
						{reportDetail.attachments.length > 0 && (
							<>
								<div className="print-section-title">III. BERKAS BUKTI & LAMPIRAN TERLAMPIR ({reportDetail.attachments.length})</div>
								<table className="print-table-grid">
									<thead>
										<tr>
											<th style={{ width: "40%" }}>Nama Berkas</th>
											<th style={{ width: "20%" }}>Ukuran</th>
											<th style={{ width: "40%" }}>Tipe Berkas</th>
										</tr>
									</thead>
									<tbody>
										{reportDetail.attachments.map((att) => (
											<tr key={att.id}>
												<td>{att.fileName}</td>
												<td>{(att.fileSize / 1024).toFixed(1)} KB</td>
												<td>{att.mimeType}</td>
											</tr>
										))}
									</tbody>
								</table>
							</>
						)}

						{/* IV. Linimasa Perubahan Status & Disposisi */}
						<div className="print-section-title">IV. LINIMASA & RIWAYAT TRIASE KASUS</div>
						<table className="print-table-grid">
							<thead>
								<tr>
									<th style={{ width: "25%" }}>Waktu & Tanggal</th>
									<th style={{ width: "25%" }}>Perubahan Status</th>
									<th style={{ width: "20%" }}>Petugas / Aktor</th>
									<th style={{ width: "30%" }}>Catatan / Alasan</th>
								</tr>
							</thead>
							<tbody>
								{reportDetail.statusHistory.map((hist) => (
									<tr key={hist.id}>
										<td>{formatDateTimeIndonesian(hist.createdAt)}</td>
										<td style={{ fontWeight: "bold" }}>{hist.fromStatus || "Awal"} &rarr; {hist.toStatus}</td>
										<td>{hist.actorName}</td>
										<td>{hist.reason || "-"}</td>
									</tr>
								))}
							</tbody>
						</table>

						{/* V. Catatan Internal & Pesan Resmi */}
						{reportDetail.messages.length > 0 && (
							<>
								<div className="print-section-title">V. CATATAN TRIASE & PESAN RESMI</div>
								<table className="print-table-grid">
									<thead>
										<tr>
											<th style={{ width: "22%" }}>Waktu</th>
											<th style={{ width: "20%" }}>Pengirim / Sifat</th>
											<th style={{ width: "58%" }}>Isi Catatan / Pesan</th>
										</tr>
									</thead>
									<tbody>
										{reportDetail.messages.map((m) => (
											<tr key={m.id}>
												<td>{formatDateTimeIndonesian(m.createdAt)}</td>
												<td style={{ fontWeight: "bold" }}>
													{m.senderName} ({m.isInternalNote ? "Catatan Internal" : "Pesan Resmi"})
												</td>
												<td>{m.content}</td>
											</tr>
										))}
									</tbody>
								</table>
							</>
						)}

						{/* VI. Lembar Pengesahan & Tanda Tangan */}
						<div className="print-sig-container">
							<div className="print-sig-col">
								<p style={{ margin: 0 }}>{sigLeftTitle}</p>
								<p style={{ margin: "2px 0 0", fontWeight: "bold" }}>{sigLeftJabatan}</p>
								<div className="print-sig-gap" />
								<p style={{ margin: 0, fontWeight: "bold", textDecoration: "underline" }}>{sigLeftNama}</p>
								<p style={{ margin: 0, fontSize: "8.5pt", color: "#475569" }}>{sigLeftNip}</p>
							</div>

							<div className="print-sig-col">
								<p style={{ margin: 0 }}>{sigRightKota}, {formatDateIndonesian(new Date())}</p>
								<p style={{ margin: "2px 0 0", fontWeight: "bold" }}>{sigRightJabatan}</p>
								<div className="print-sig-gap" />
								<p style={{ margin: 0, fontWeight: "bold", textDecoration: "underline" }}>{currentUser?.name || "Petugas Penanggung Jawab"}</p>
								<p style={{ margin: 0, fontSize: "8.5pt", color: "#475569" }}>
									Peran: {userRole ? userRole.toUpperCase().replace("_", " ") : "PETUGAS TRIASE"}
								</p>
							</div>
						</div>
					</div>,
					document.body,
				)}
			</div>
		</Layout>
	);
}
