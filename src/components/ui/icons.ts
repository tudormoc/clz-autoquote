/**
 * The icons of the app, by name: every file takes its icons from here, never from the icon package itself (ESLint
 * refuses that). So the set is changed in one place: a skin that brings its own drawings gives each name its drawing
 * here, and the screens follow (theme.js → SKIN, docs/BACKLOG.md → Skins). A new icon is one more name in the list.
 */
export {
    AlertCircle, AlertTriangle, AppWindow, Archive, ArrowDown, ArrowDownRight, ArrowDownToLine, ArrowLeftRight,
    ArrowRight, ArrowUp, ArrowUpDown, ArrowUpRight, ArrowUpToLine, BadgeCheck, Ban, Banknote,
    BarChart3, BookOpen, Boxes, Calendar, CalendarCheck, CalendarClock, CalendarDays, CalendarOff,
    CalendarRange, CaseUpper, Check, CheckCircle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
    ChevronsUpDown, ChevronUp, Circle, CircleAlert, CircleDot, ClipboardList, Clock, Contact,
    Copy, Cpu, Database, Dices, DollarSign, Download, EqualNot, Euro,
    ExternalLink, Eye, FileText, Flag, Folder, FolderTree, FoldHorizontal, Globe,
    Hash, HelpCircle, History, Hourglass, Inbox, Info, KeyRound, Landmark,
    Layers, Link2, ListChecks, ListTodo, Loader2, Lock, LogIn, LogOut,
    Mail, Maximize2, Menu, MessageSquare, Minus, Moon, MoreHorizontal,
    Package, PanelLeftClose, PanelLeftOpen, Pause, Pencil, Phone, Pin, Play,
    PlayCircle, Plus, Printer, RefreshCw, Repeat, RotateCcw, Save, Scale,
    ScrollText, Search, Settings, SkipForward, SlidersHorizontal, Sun, Table2, Tag,
    Tags, Target, Trash2, Truck, Undo2, UserPlus, UserRound, Users,
    UsersRound, Wallet, Workflow, X, XCircle,
} from 'lucide-react';

/** What an icon is to a part that is handed one (`icon={Users}`): it takes `size`, `className`, `strokeWidth` */
export type { LucideIcon } from 'lucide-react';
