import { Link, router, usePage } from "@inertiajs/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Role, SharedPageProps } from "../../shared/types";
import Brand from "./Brand";
import "./Layout.css";

type NavItem = {
	href: string;
	label: string;
	icon: ReactNode;
	roles?: Role[];
	/** Match prefix so `/admin` highlights on `/admin?page=2`. */
	match?: (path: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
	{
		href: "/dashboard",
		label: "Dashboard",
		icon: (
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<rect x="3" y="3" width="7" height="9" rx="1" />
				<rect x="14" y="3" width="7" height="5" rx="1" />
				<rect x="14" y="12" width="7" height="9" rx="1" />
				<rect x="3" y="16" width="7" height="5" rx="1" />
			</svg>
		),
		match: (p) => p === "/dashboard" || p.startsWith("/dashboard"),
	},
	{
		href: "/profile",
		label: "Profile",
		icon: (
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		),
		match: (p) => p === "/profile" || p.startsWith("/profile"),
	},
	{
		href: "/admin",
		label: "Admin",
		roles: ["admin"],
		icon: (
			<svg
				viewBox="0 0 24 24"
				width="18"
				height="18"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" />
				<path d="m9 12 2 2 4-4" />
			</svg>
		),
		match: (p) => p === "/admin" || p.startsWith("/admin"),
	},
];

const ICON_BELL = (
	<svg
		viewBox="0 0 24 24"
		width="18"
		height="18"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
		<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
	</svg>
);

const ICON_SEARCH = (
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<circle cx="11" cy="11" r="7" />
		<path d="m21 21-4.3-4.3" />
	</svg>
);

const ICON_SUN = (
	<svg
		viewBox="0 0 24 24"
		width="18"
		height="18"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="4" />
		<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
	</svg>
);

const ICON_MOON = (
	<svg
		viewBox="0 0 24 24"
		width="18"
		height="18"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
	</svg>
);

const ICON_CHEVRON = (
	<svg
		viewBox="0 0 24 24"
		width="14"
		height="14"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="m6 9 6 6 6-6" />
	</svg>
);

const ICON_LOGOUT = (
	<svg
		viewBox="0 0 24 24"
		width="16"
		height="16"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
		<path d="m16 17 5-5-5-5M21 12H9" />
	</svg>
);

const ICON_MENU = (
	<svg
		viewBox="0 0 24 24"
		width="20"
		height="20"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M3 6h18M3 12h18M3 18h18" />
	</svg>
);

const ICON_CLOSE = (
	<svg
		viewBox="0 0 24 24"
		width="20"
		height="20"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M18 6 6 18M6 6l12 12" />
	</svg>
);

type Theme = "light" | "dark";

/**
 * Read the theme the inline head script already applied to <html data-theme>.
 * Falls back to prefers-color-scheme, then light: mirroring the inline script
 * so the React state stays in sync on first mount without a re-render flash.
 */
function getInitialTheme(): Theme {
	if (typeof document !== "undefined") {
		const attr = document.documentElement.getAttribute("data-theme");
		if (attr === "light" || attr === "dark") return attr;
	}
	if (
		typeof matchMedia !== "undefined" &&
		matchMedia("(prefers-color-scheme: dark)").matches
	) {
		return "dark";
	}
	return "light";
}

function initials(name: string): string {
	return (
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((s) => s[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

/** Professional SaaS dashboard shell: collapsible sidebar, topbar with search,
 *  notifications, theme toggle and a user dropdown; flash banners; content; footer. */
export default function Layout({ children }: { children: ReactNode }) {
	const { props, flash, url } = usePage<SharedPageProps>();
	const user = props.auth.user;

	const [theme, setTheme] = useState<Theme>("light");
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState<boolean>(() => {
		if (typeof window !== "undefined") {
			return localStorage.getItem("desktop_sidebar_collapsed") === "true";
		}
		return false;
	});
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const [notifOpen, setNotifOpen] = useState(false);
	const notifRef = useRef<HTMLDivElement>(null);
	const [unreadCount, setUnreadCount] = useState(3);

	const toggleDesktopSidebar = () => {
		setDesktopSidebarCollapsed((prev) => {
			const next = !prev;
			if (typeof window !== "undefined") {
				localStorage.setItem("desktop_sidebar_collapsed", String(next));
			}
			return next;
		});
	};
	// Skip the apply effect on initial mount: the inline head script
	// (themeBoot) already set data-theme + background-color on <html>.
	const skipApply = useRef(true);

	// Sync React state from <html data-theme> BEFORE paint so the toggle
	// icon matches the active theme immediately. useLayoutEffect runs
	// synchronously after commit, before the browser paints: preventing
	// a flash where the apply effect would briefly set "light" on the DOM.
	useLayoutEffect(() => {
		setTheme(getInitialTheme());
	}, []);

	// Persist + apply theme whenever the toggle changes it. Skipped on
	// initial mount (DOM already correct); only user-initiated toggles apply.
	useEffect(() => {
		if (skipApply.current) {
			skipApply.current = false;
			return;
		}
		const el = document.documentElement;
		el.setAttribute("data-theme", theme);
		el.style.backgroundColor = theme === "dark" ? "#0f1117" : "#f6f7fb";
		try {
			localStorage.setItem("theme", theme);
		} catch {
			/* ignore (private mode / SSR) */
		}
	}, [theme]);

	// Close dropdowns on outside click.
	useEffect(() => {
		if (!menuOpen && !notifOpen) return;
		const onDown = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node))
				setMenuOpen(false);
			if (notifRef.current && !notifRef.current.contains(e.target as Node))
				setNotifOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setMenuOpen(false);
				setNotifOpen(false);
			}
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [menuOpen, notifOpen]);

	// Close mobile sidebar on route change. `url` is listed deliberately
	// (the body doesn't read it: the effect is keyed on route change).
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional, run on every navigation
	useEffect(() => {
		setSidebarOpen(false);
		setMenuOpen(false);
	}, [url]);

	const currentPath = url?.split("?")[0] ?? "";
	const items = NAV_ITEMS.filter(
		(i) => !i.roles || (user && i.roles.includes(user.role)),
	);

	const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

	const handleLogout = () => {
		setMenuOpen(false);
		router.post("/logout");
	};

	return (
		<div className={`dash ${desktopSidebarCollapsed ? "dash-sidebar-collapsed" : ""}`}>
			{/* Mobile backdrop */}
			{sidebarOpen ? (
				<div
					className="dash-backdrop"
					aria-hidden="true"
					onClick={() => setSidebarOpen(false)}
				/>
			) : null}

			{/* Sidebar */}
			<aside
				className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}
				aria-label="Primary"
			>
				<div className="sidebar-head">
					<Brand href={user ? "/dashboard" : "/login"} />
					<button
						type="button"
						className="sidebar-close"
						aria-label="Close navigation"
						onClick={() => setSidebarOpen(false)}
					>
						{ICON_CLOSE}
					</button>
				</div>

				<nav className="sidebar-nav">
					<p className="sidebar-section">Menu</p>
					<ul>
						{items.map((item) => {
							const active = item.match
								? item.match(currentPath)
								: currentPath === item.href;
							return (
								<li key={item.href}>
									<Link
										href={item.href}
										className={`sidebar-link${active ? " sidebar-link-active" : ""}`}
										aria-current={active ? "page" : undefined}
									>
										<span className="sidebar-link-icon">{item.icon}</span>
										<span>{item.label}</span>
									</Link>
								</li>
							);
						})}
					</ul>
				</nav>

				<div className="sidebar-foot">
					<div className="sidebar-foot-card">
						<p className="sidebar-foot-title">LAPOR MTsN 3 Kota Padang</p>
						<p className="sidebar-foot-sub">Bun · SQLite · Inertia v3</p>
					</div>
				</div>
			</aside>

			{/* Main column */}
			<div className="dash-main">
				<header className="topbar">
					<div className="topbar-left">
						<button
							type="button"
							className="topbar-toggle"
							aria-label="Toggle navigation sidebar"
							title={desktopSidebarCollapsed ? "Tampilkan Sidebar Utam" : "Sembunyikan Sidebar Utama"}
							aria-expanded={sidebarOpen || !desktopSidebarCollapsed}
							onClick={() => {
								if (typeof window !== "undefined" && window.innerWidth <= 768) {
									setSidebarOpen((v) => !v);
								} else {
									toggleDesktopSidebar();
								}
							}}
						>
							{ICON_MENU}
						</button>
						<label className="topbar-search">
							<span className="topbar-search-icon">{ICON_SEARCH}</span>
							<input type="search" placeholder="Search…" aria-label="Search" />
							<kbd className="topbar-search-kbd">⌘K</kbd>
						</label>
					</div>

					<div className="topbar-right">
						<div style={{ position: "relative" }} ref={notifRef}>
							<button
								type="button"
								className="topbar-icon-btn"
								aria-label="Notifications"
								onClick={() => setNotifOpen((v) => !v)}
								title="Notifikasi Sistem"
							>
								{ICON_BELL}
								{unreadCount > 0 && <span className="topbar-dot" aria-hidden="true" />}
							</button>

							{notifOpen && (
								<div className="notif-dropdown">
									<div className="notif-header">
										<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
											<span style={{ fontWeight: 700, fontSize: "0.9rem" }}>🔔 Notifikasi & Aktivitas</span>
											{unreadCount > 0 && (
												<span className="badge badge-primary" style={{ fontSize: "0.72rem", padding: "0.15rem 0.45rem" }}>
													{unreadCount} Baru
												</span>
											)}
										</div>
										<button
											type="button"
											onClick={() => setUnreadCount(0)}
											style={{ background: "transparent", border: "none", color: "var(--primary)", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
										>
											Tandai Dibaca
										</button>
									</div>

									<div className="notif-body">
										<div className={`notif-item ${unreadCount > 0 ? "unread" : ""}`}>
											<div className="notif-item-icon">📋</div>
											<div className="notif-item-content">
												<span className="notif-title">Laporan Baru Membutuhkan Triase</span>
												<span className="notif-sub">Laporan pengaduan baru telah terdaftar dan menunggu verifikasi skala prioritas & disposisi.</span>
												<span className="notif-time">Baru saja</span>
											</div>
										</div>

										<div className={`notif-item ${unreadCount > 1 ? "unread" : ""}`}>
											<div className="notif-item-icon">💬</div>
											<div className="notif-item-content">
												<span className="notif-title">Pesan Balasan Dari Pelapor</span>
												<span className="notif-sub">Pelapor menyertakan tanggapan balasan pada tiket pelacakan aktif.</span>
												<span className="notif-time">10 menit yang lalu</span>
											</div>
										</div>

										<div className="notif-item">
											<div className="notif-item-icon">🔒</div>
											<div className="notif-item-content">
												<span className="notif-title">Sistem Triase & Keamanan Aktif</span>
												<span className="notif-sub">Seluruh saluran Whistleblowing & Audit Trail beroperasi secara aman.</span>
												<span className="notif-time">Hari ini</span>
											</div>
										</div>
									</div>

									<div className="notif-footer">
										<Link
											href="/admin"
											onClick={() => setNotifOpen(false)}
											style={{ fontSize: "0.82rem", color: "var(--primary)", fontWeight: 600, textDecoration: "none" }}
										>
											Buka Kelola Laporan (Backoffice) →
										</Link>
									</div>
								</div>
							)}
						</div>

						<button
							type="button"
							className="topbar-icon-btn"
							aria-label="Toggle theme"
							onClick={toggleTheme}
						>
							{theme === "dark" ? ICON_SUN : ICON_MOON}
						</button>

						{user ? (
							<div className="user-menu" ref={menuRef}>
								<button
									type="button"
									className="user-menu-trigger"
									aria-haspopup="menu"
									aria-expanded={menuOpen}
									onClick={() => setMenuOpen((v) => !v)}
								>
									{user.avatarUrl ? (
										<img
											className="avatar avatar-img"
											src={user.avatarUrl}
											alt=""
										/>
									) : (
										<span className="avatar" aria-hidden="true">
											{initials(user.name)}
										</span>
									)}
									<span className="user-menu-meta">
										<span className="user-menu-name">{user.name}</span>
										<span className="user-menu-role">{user.role}</span>
									</span>
									<span className="user-menu-chevron">{ICON_CHEVRON}</span>
								</button>

								{menuOpen ? (
									<div className="user-menu-panel" role="menu">
										<div className="user-menu-head">
											{user.avatarUrl ? (
												<img
													className="avatar avatar-lg avatar-img"
													src={user.avatarUrl}
													alt=""
												/>
											) : (
												<span className="avatar avatar-lg" aria-hidden="true">
													{initials(user.name)}
												</span>
											)}
											<div className="user-menu-head-meta">
												<span className="user-menu-head-name">{user.name}</span>
												<span className="user-menu-head-email">
													{user.email}
												</span>
											</div>
										</div>
										<div className="user-menu-divider" />
										<Link
											href="/dashboard"
											className="user-menu-item"
											role="menuitem"
										>
											Dashboard
										</Link>
										{user.role === "admin" ? (
											<Link
												href="/admin"
												className="user-menu-item"
												role="menuitem"
											>
												Admin console
											</Link>
										) : null}
										<div className="user-menu-divider" />
										<button
											type="button"
											className="user-menu-item user-menu-danger"
											role="menuitem"
											onClick={handleLogout}
										>
											<span className="user-menu-item-icon">{ICON_LOGOUT}</span>
											<span>Log out</span>
										</button>
									</div>
								) : null}
							</div>
						) : (
							<div className="topbar-auth">
								<Link href="/login" className="btn btn-primary">
									Masuk Akun Petugas
								</Link>
							</div>
						)}
					</div>
				</header>

				{flash.success ? (
					<div className="flash flash-success">{String(flash.success)}</div>
				) : null}
				{flash.error ? (
					<div className="flash flash-error">{String(flash.error)}</div>
				) : null}

				<main className="content">{children}</main>

				<footer className="footer">
					<span>LAPOR MTsN 3 Kota Padang</span>
					<span className="footer-stack">
						Bun · Hono · bun:sqlite · Inertia v3
					</span>
				</footer>
			</div>
		</div>
	);
}
