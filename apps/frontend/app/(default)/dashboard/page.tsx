'use client';

import { SwissGrid } from '@/components/home/swiss-grid';
import { ResumeUploadDialog } from '@/components/dashboard/resume-upload-dialog';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Card, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { useTranslations } from '@/lib/i18n';
import { Dropdown, type DropdownOption } from '@/components/ui/dropdown';

// Optimized Imports for Performance (No Barrel Imports)
import Loader2 from 'lucide-react/dist/esm/icons/loader-2';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Plus from 'lucide-react/dist/esm/icons/plus';
import Settings from 'lucide-react/dist/esm/icons/settings';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
import LayoutGrid from 'lucide-react/dist/esm/icons/layout-grid';
import List from 'lucide-react/dist/esm/icons/list';
import ArrowUpDown from 'lucide-react/dist/esm/icons/arrow-up-down';
import Filter from 'lucide-react/dist/esm/icons/filter';
import X from 'lucide-react/dist/esm/icons/x';

import {
  fetchResume,
  fetchResumeList,
  deleteResume,
  retryProcessing,
  fetchJobDescription,
  type ResumeListItem,
} from '@/lib/api/resume';
import { useStatusCache } from '@/lib/context/status-cache';

type ProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed' | 'loading';
type ViewMode = 'tiles' | 'list';
type SortField = 'company' | 'position' | 'status' | 'date';
type SortOrder = 'asc' | 'desc';

export default function DashboardPage() {
  const { t, locale } = useTranslations();
  const [masterResumeId, setMasterResumeId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('loading');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tailoredResumes, setTailoredResumes] = useState<ResumeListItem[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const router = useRouter();

  // Status cache for optimistic counter updates and LLM status check
  const {
    status: systemStatus,
    isLoading: statusLoading,
    incrementResumes,
    decrementResumes,
    setHasMasterResume,
  } = useStatusCache();

  // View mode, sorting, and filtering state
  const [viewMode, setViewMode] = useState<ViewMode>('tiles');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filterCompany, setFilterCompany] = useState<string>('');
  const [filterPosition, setFilterPosition] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Request id guard for concurrent loadTailoredResumes invocations
  const loadRequestIdRef = useRef(0);
  // Lightweight in-memory cache for job snippets to avoid N+1 refetches
  const jobSnippetCacheRef = useRef<Record<string, string>>({});

  // Check if LLM is configured (API key is set)
  const isLlmConfigured = !statusLoading && systemStatus?.llm_configured;

  const isTailorEnabled =
    Boolean(masterResumeId) && processingStatus === 'ready' && isLlmConfigured;

  const formatDate = (value: string) => {
    if (!value) return t('common.unknown');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('common.unknown');

    const dateLocale =
      locale === 'es' ? 'es-ES' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US';

    return date.toLocaleDateString(dateLocale, {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  };

  const checkResumeStatus = useCallback(async (resumeId: string) => {
    try {
      setProcessingStatus('loading');
      const data = await fetchResume(resumeId);
      const status = data.raw_resume?.processing_status || 'pending';
      setProcessingStatus(status as ProcessingStatus);
    } catch (err: unknown) {
      console.error('Failed to check resume status:', err);
      // If resume not found (404), clear the stale localStorage
      if (err instanceof Error && err.message.includes('404')) {
        localStorage.removeItem('master_resume_id');
        setMasterResumeId(null);
        return;
      }
      setProcessingStatus('failed');
    }
  }, []);

  useEffect(() => {
    const storedId = localStorage.getItem('master_resume_id');
    if (storedId) {
      setMasterResumeId(storedId);
      checkResumeStatus(storedId);
    }
  }, [checkResumeStatus]);

  const loadTailoredResumes = useCallback(async () => {
    try {
      const data = await fetchResumeList(true);
      const masterFromList = data.find((r) => r.is_master);
      const storedId = localStorage.getItem('master_resume_id');
      const resolvedMasterId = masterFromList?.resume_id || storedId;

      if (resolvedMasterId) {
        localStorage.setItem('master_resume_id', resolvedMasterId);
        setMasterResumeId(resolvedMasterId);
        checkResumeStatus(resolvedMasterId);
      } else {
        localStorage.removeItem('master_resume_id');
        setMasterResumeId(null);
      }

      const filtered = data.filter((r) => r.resume_id !== resolvedMasterId);
      setTailoredResumes(filtered);

      // Only fetch job descriptions for resumes that are actually tailored
      // (identified by having a non-null parent_id). This avoids N+1 calls
      // for untailored resumes.
      const tailoredWithParent = filtered.filter((r) => r.parent_id);

      // Guard against concurrent invocations overwriting each other
      const requestId = ++loadRequestIdRef.current;

      // Fetch job description snippets for tailored resumes in parallel and attach to state
      // Use a small in-memory cache to avoid re-fetching the same snippet repeatedly.
      const jobSnippets: Record<string, string> = {};
      await Promise.all(
        tailoredWithParent.map(async (r) => {
          // Use cached snippet when available
          if (jobSnippetCacheRef.current[r.resume_id]) {
            jobSnippets[r.resume_id] = jobSnippetCacheRef.current[r.resume_id];
            return;
          }
          try {
            const jd = await fetchJobDescription(r.resume_id);
            const snippet = (jd?.content || '').slice(0, 80);
            jobSnippetCacheRef.current[r.resume_id] = snippet;
            jobSnippets[r.resume_id] = snippet;
          } catch {
            // ignore missing job descriptions and cache empty result
            jobSnippetCacheRef.current[r.resume_id] = '';
            jobSnippets[r.resume_id] = '';
          }
        })
      );

      // Only apply results if this invocation is the latest (prevents stale overwrite)
      if (requestId === loadRequestIdRef.current) {
        setTailoredResumes((prev) =>
          prev.map((r) => ({ ...r, jobSnippet: jobSnippets[r.resume_id] || '' }))
        );
      }
    } catch (err) {
      console.error('Failed to load tailored resumes:', err);
    }
  }, [checkResumeStatus]);

  useEffect(() => {
    loadTailoredResumes();
  }, [loadTailoredResumes]);

  // Refresh list when window gains focus (e.g., returning from viewer after delete)
  useEffect(() => {
    const handleFocus = () => {
      loadTailoredResumes();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadTailoredResumes, checkResumeStatus]);

  const handleUploadComplete = (resumeId: string) => {
    localStorage.setItem('master_resume_id', resumeId);
    setMasterResumeId(resumeId);
    // Check status after upload completes
    checkResumeStatus(resumeId);
    // Update cached counters
    incrementResumes();
    setHasMasterResume(true);
  };

  const handleRetryProcessing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!masterResumeId) return;
    setIsRetrying(true);
    try {
      const result = await retryProcessing(masterResumeId);
      if (result.processing_status === 'ready') {
        setProcessingStatus('ready');
      } else if (
        result.processing_status === 'processing' ||
        result.processing_status === 'pending'
      ) {
        setProcessingStatus(result.processing_status);
      } else {
        setProcessingStatus('failed');
      }
    } catch (err) {
      console.error('Retry processing failed:', err);
      setProcessingStatus('failed');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDeleteAndReupload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const confirmDeleteAndReupload = async () => {
    if (!masterResumeId) return;
    try {
      await deleteResume(masterResumeId);
      decrementResumes();
      setHasMasterResume(false);
      localStorage.removeItem('master_resume_id');
      setMasterResumeId(null);
      setProcessingStatus('loading');
      setIsUploadDialogOpen(true);
      await loadTailoredResumes();
    } catch (err) {
      console.error('Failed to delete resume:', err);
    }
  };

  const getStatusDisplay = () => {
    switch (processingStatus) {
      case 'loading':
        return {
          text: t('dashboard.status.checking'),
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          color: 'text-gray-500',
        };
      case 'processing':
        return {
          text: t('dashboard.status.processing'),
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          color: 'text-blue-700',
        };
      case 'ready':
        return { text: t('dashboard.status.ready'), icon: null, color: 'text-green-700' };
      case 'failed':
        return {
          text: t('dashboard.status.failed'),
          icon: <AlertCircle className="w-3 h-3" />,
          color: 'text-red-600',
        };
      default:
        return { text: t('dashboard.status.pending'), icon: null, color: 'text-gray-500' };
    }
  };

  const getMonogram = (title: string): string => {
    const words = title.split(/\s+/).filter((w) => /^[a-zA-Z]/.test(w));
    return words
      .slice(0, 3)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');
  };

  const extractCompanyFromTitle = (title: string): string => {
    if (title.includes(' @ ')) {
      return title.split(' @ ')[1]?.trim() || '';
    }
    if (title.includes('@')) {
      return title.split('@')[1]?.trim() || '';
    }
    return '';
  };

  const extractPositionFromTitle = (title: string): string => {
    if (title.includes(' @ ')) {
      return title.split(' @ ')[0]?.trim() || title;
    }
    if (title.includes('@')) {
      return title.split('@')[0]?.trim() || title;
    }
    return title;
  };

  // Get unique companies and positions for filter dropdowns
  const uniqueCompanies = useMemo(() => {
    const companies = new Set<string>();
    tailoredResumes.forEach((r) => {
      const title = r.title || r.jobSnippet || r.filename || '';
      const company = extractCompanyFromTitle(title);
      if (company) companies.add(company);
    });
    return Array.from(companies).sort();
  }, [tailoredResumes]);

  const uniquePositions = useMemo(() => {
    const positions = new Set<string>();
    tailoredResumes.forEach((r) => {
      const title = r.title || r.jobSnippet || r.filename || '';
      const position = extractPositionFromTitle(title);
      if (position) positions.add(position);
    });
    return Array.from(positions).sort();
  }, [tailoredResumes]);

  // Filter and sort resumes
  const filteredAndSortedResumes = useMemo(() => {
    let result = [...tailoredResumes];

    // Filter by company
    if (filterCompany) {
      result = result.filter((r) => {
        const title = r.title || r.jobSnippet || r.filename || '';
        return extractCompanyFromTitle(title) === filterCompany;
      });
    }

    // Filter by position
    if (filterPosition) {
      result = result.filter((r) => {
        const title = r.title || r.jobSnippet || r.filename || '';
        return extractPositionFromTitle(title) === filterPosition;
      });
    }

    // Filter by status
    if (filterStatus) {
      result = result.filter((r) => r.processing_status === filterStatus);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'company': {
          const aTitle = a.title || a.jobSnippet || a.filename || '';
          const bTitle = b.title || b.jobSnippet || b.filename || '';
          comparison = extractCompanyFromTitle(aTitle).localeCompare(extractCompanyFromTitle(bTitle));
          break;
        }
        case 'position': {
          const aTitle = a.title || a.jobSnippet || a.filename || '';
          const bTitle = b.title || b.jobSnippet || b.filename || '';
          comparison = extractPositionFromTitle(aTitle).localeCompare(extractPositionFromTitle(bTitle));
          break;
        }
        case 'status':
          comparison = a.processing_status.localeCompare(b.processing_status);
          break;
        case 'date':
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [tailoredResumes, filterCompany, filterPosition, filterStatus, sortField, sortOrder]);

  const hasActiveFilters = filterCompany || filterPosition || filterStatus;

  // Dropdown options
  const sortOptions: DropdownOption[] = [
    { id: 'date', label: t('dashboard.sort.date') || 'Date' },
    { id: 'company', label: t('dashboard.sort.company') || 'Company' },
    { id: 'position', label: t('dashboard.sort.position') || 'Position' },
    { id: 'status', label: t('dashboard.sort.status') || 'Status' },
  ];

  const statusOptions: DropdownOption[] = [
    { id: '', label: t('dashboard.filter.allStatuses') || 'All Statuses' },
    { id: 'pending', label: t('dashboard.status.pending') || 'Pending' },
    { id: 'processing', label: t('dashboard.status.processing') || 'Processing' },
    { id: 'ready', label: t('dashboard.status.ready') || 'Ready' },
    { id: 'failed', label: t('dashboard.status.failed') || 'Failed' },
  ];

  // Muted palette that complements the #F0F0E8 canvas
  const cardPalette = [
    { bg: '#1D4ED8', fg: '#FFFFFF' }, // Hyper Blue
    { bg: '#15803D', fg: '#FFFFFF' }, // Signal Green
    { bg: '#000000', fg: '#FFFFFF' }, // Ink
    { bg: '#92400E', fg: '#FFFFFF' }, // Warm Brown
    { bg: '#7C3AED', fg: '#FFFFFF' }, // Violet
    { bg: '#0E7490', fg: '#FFFFFF' }, // Teal
    { bg: '#B91C1C', fg: '#FFFFFF' }, // Deep Red
    { bg: '#4338CA', fg: '#FFFFFF' }, // Indigo
  ];

  const hashTitle = (title: string): number => {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = (hash << 5) - hash + title.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const totalCards = viewMode === 'tiles' ? 1 + tailoredResumes.length + 1 : 0;
  const fillerCount = Math.max(0, (5 - (totalCards % 5)) % 5);
  const extraFillerCount = viewMode === 'tiles' ? 5 : 0;
  // Use Tailwind classes for fillers now that we have them in config or use specific hex if needed
  // Using the hex values from before to maintain exact look, or we could map them to variants
  const fillerPalette = ['bg-[#E5E5E0]', 'bg-[#D8D8D2]', 'bg-[#CFCFC7]', 'bg-[#E0E0D8]'];

  return (
    <div className="space-y-6">
      {/* Configuration Warning Banner */}
      {masterResumeId && !isLlmConfigured && !statusLoading && (
        <div className="border-2 border-warning bg-amber-50 p-4 shadow-sw-default mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <div>
              <p className="font-mono text-sm font-bold uppercase tracking-wider text-amber-800">
                {t('dashboard.llmNotConfiguredTitle')}
              </p>
              <p className="font-mono text-xs text-amber-700 mt-0.5">
                {t('dashboard.llmNotConfiguredMessage')}
              </p>
            </div>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="border-warning text-amber-700">
              <Settings className="w-4 h-4 mr-2" />
              {t('nav.settings')}
            </Button>
          </Link>
        </div>
      )}

      {/* Filter and View Controls Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* View Switcher */}
        <div className="flex items-center border border-black bg-white">
          <button
            onClick={() => setViewMode('tiles')}
            className={`p-2 transition-colors ${
              viewMode === 'tiles' ? 'bg-black text-white' : 'hover:bg-gray-100'
            }`}
            title={t('dashboard.view.tiles') || 'Tiles'}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 transition-colors ${
              viewMode === 'list' ? 'bg-black text-white' : 'hover:bg-gray-100'
            }`}
            title={t('dashboard.view.list') || 'List'}
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-gray-500" />
          <Dropdown
            options={sortOptions}
            value={sortField}
            onChange={(val) => setSortField(val as SortField)}
            className="w-36"
          />
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-2 border border-black bg-white hover:bg-gray-100 transition-colors"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            <span className={`text-xs font-mono ${sortOrder === 'asc' ? '' : 'rotate-180'}`}>↑↓</span>
          </button>
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 border transition-colors ${
            showFilters || hasActiveFilters ? 'border-black bg-black text-white' : 'border-black bg-white hover:bg-gray-100'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="font-mono text-xs uppercase">
            {t('dashboard.filter.title') || 'Filter'}
          </span>
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-green-500 rounded-full" />
          )}
        </button>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilterCompany('');
              setFilterPosition('');
              setFilterStatus('');
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-red-600 hover:bg-red-50 transition-colors"
          >
            <X className="w-3 h-3" />
            {t('dashboard.filter.clear') || 'Clear'}
          </button>
        )}

        <span className="text-xs font-mono text-gray-500 ml-auto">
          {filteredAndSortedResumes.length} {t('dashboard.items') || 'items'}
        </span>
      </div>

      {/* Expandable Filter Panel */}
      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 p-4 border border-black bg-white mb-4">
          <div className="w-48">
            <Dropdown
              options={[
                { id: '', label: t('dashboard.filter.allCompanies') || 'All Companies' },
                ...uniqueCompanies.map((c) => ({ id: c, label: c })),
              ]}
              value={filterCompany}
              onChange={setFilterCompany}
              label={t('dashboard.filter.company') || 'Company'}
            />
          </div>
          <div className="w-48">
            <Dropdown
              options={[
                { id: '', label: t('dashboard.filter.allPositions') || 'All Positions' },
                ...uniquePositions.map((p) => ({ id: p, label: p })),
              ]}
              value={filterPosition}
              onChange={setFilterPosition}
              label={t('dashboard.filter.position') || 'Position'}
            />
          </div>
          <div className="w-40">
            <Dropdown
              options={statusOptions}
              value={filterStatus}
              onChange={setFilterStatus}
              label={t('dashboard.filter.status') || 'Status'}
            />
          </div>
        </div>
      )}

      <SwissGrid>
        {/* 1. Master Resume Logic */}
        {!masterResumeId ? (
          // LLM Not Configured or Upload State
          !isLlmConfigured && !statusLoading ? (
            <Link href="/settings" className="block h-full">
              <Card
                variant="interactive"
                className="aspect-square h-full border-dashed border-warning bg-amber-50"
              >
                <div className="flex-1 flex flex-col justify-between">
                  <div className="w-14 h-14 border-2 border-warning bg-white flex items-center justify-center mb-4">
                    <AlertTriangle className="w-7 h-7 text-warning" />
                  </div>
                  <div>
                    <CardTitle className="text-lg uppercase text-amber-800 mb-2">
                      {t('dashboard.setupRequiredTitle')}
                    </CardTitle>
                    <CardDescription className="text-amber-700 text-xs">
                      {t('dashboard.setupRequiredMessage')}
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-4 text-amber-700 group-hover:text-amber-900">
                      <Settings className="w-4 h-4" />
                      <span className="font-mono text-xs font-bold uppercase">
                        {t('nav.goToSettings')}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ) : (
            <ResumeUploadDialog
              open={isUploadDialogOpen}
              onOpenChange={setIsUploadDialogOpen}
              onUploadComplete={handleUploadComplete}
              trigger={
                <Card
                  variant="interactive"
                  className="aspect-square h-full hover:bg-primary hover:text-canvas"
                >
                  <div className="flex-1 flex flex-col justify-between pointer-events-none">
                    <div className="w-14 h-14 border-2 border-current flex items-center justify-center mb-4">
                      <span className="text-2xl leading-none relative top-[-2px]">+</span>
                    </div>
                    <div>
                      <CardTitle className="text-xl uppercase">
                        {t('dashboard.initializeMasterResume')}
                      </CardTitle>
                      <CardDescription className="mt-2 opacity-60 group-hover:opacity-100 text-current">
                        {'// '}
                        {t('dashboard.initializeSequence')}
                      </CardDescription>
                    </div>
                  </div>
                </Card>
              }
            />
          )
        ) : (
          // Master Resume Exists
          <Card
            variant="interactive"
            className="aspect-square h-full"
            onClick={() => router.push(`/resumes/${masterResumeId}`)}
          >
            <div className="flex-1 flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 border-2 border-black bg-blue-700 text-white flex items-center justify-center">
                  <span className="font-mono font-bold text-lg">M</span>
                </div>
                <div className="flex gap-1">
                  {processingStatus === 'failed' && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-blue-100 hover:text-blue-700 z-10 rounded-none relative"
                        onClick={handleRetryProcessing}
                        disabled={isRetrying}
                        title={t('dashboard.retryProcessing')}
                      >
                        {isRetrying ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <CardTitle className="text-lg group-hover:text-primary">
                {t('dashboard.masterResume')}
              </CardTitle>

              <div
                className={`text-xs font-mono mt-auto pt-4 flex flex-col gap-2 uppercase ${getStatusDisplay().color}`}
              >
                <div className="flex items-center gap-1">
                  {getStatusDisplay().icon}
                  {t('dashboard.statusLine', { status: getStatusDisplay().text })}
                </div>
                {processingStatus === 'failed' && (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 rounded-none border-black"
                      onClick={handleRetryProcessing}
                      disabled={isRetrying}
                    >
                      {isRetrying
                        ? t('dashboard.retryingProcessing')
                        : t('dashboard.retryProcessing')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 rounded-none border-red-600 text-red-600 hover:bg-red-50"
                      onClick={handleDeleteAndReupload}
                    >
                      {t('dashboard.deleteAndReupload')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* 2. Tailored Resumes */}
        {viewMode === 'tiles' ? (
          filteredAndSortedResumes.map((resume) => {
            const title =
              resume.title || resume.jobSnippet || resume.filename || t('dashboard.tailoredResume');
            const color = cardPalette[hashTitle(title) % cardPalette.length];
            return (
              <Card
                key={resume.resume_id}
                variant="interactive"
                className="aspect-square h-full bg-canvas"
                onClick={() => router.push(`/resumes/${resume.resume_id}`)}
              >
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <div
                      className="w-12 h-12 border-2 border-black flex items-center justify-center"
                      style={{ backgroundColor: color.bg, color: color.fg }}
                    >
                      <span className="font-mono font-bold">{getMonogram(title)}</span>
                    </div>
                    <span className="font-mono text-xs text-gray-500 uppercase">
                      {resume.processing_status}
                    </span>
                  </div>
                  <CardTitle className="text-lg">
                    <span className="block font-serif text-base font-bold leading-tight mb-1 w-full line-clamp-2">
                      {title}
                    </span>
                  </CardTitle>
                  <CardDescription className="mt-auto pt-4 uppercase">
                    {t('dashboard.edited', {
                      date: formatDate(resume.updated_at || resume.created_at),
                    })}{' '}
                  </CardDescription>
                </div>
              </Card>
            );
          })
        ) : (
          // List View
          <div className="col-span-full space-y-2">
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 font-mono text-xs font-bold uppercase text-gray-500 border-b border-gray-200">
              <div className="col-span-4">{t('dashboard.list.position') || 'Position'}</div>
              <div className="col-span-3">{t('dashboard.list.company') || 'Company'}</div>
              <div className="col-span-2">{t('dashboard.list.status') || 'Status'}</div>
              <div className="col-span-3 text-right">{t('dashboard.list.date') || 'Date'}</div>
            </div>
            {filteredAndSortedResumes.map((resume) => {
              const title =
                resume.title || resume.jobSnippet || resume.filename || t('dashboard.tailoredResume');
              const company = extractCompanyFromTitle(title);
              const position = extractPositionFromTitle(title);
              const color = cardPalette[hashTitle(title) % cardPalette.length];
              return (
                <div
                  key={resume.resume_id}
                  onClick={() => router.push(`/resumes/${resume.resume_id}`)}
                  className="grid grid-cols-12 gap-4 px-4 py-3 border border-black bg-canvas hover:bg-gray-50 cursor-pointer transition-colors items-center"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <div
                      className="w-8 h-8 border border-black flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: color.bg, color: color.fg }}
                    >
                      {getMonogram(title)}
                    </div>
                    <span className="font-serif font-bold text-sm truncate">{position}</span>
                  </div>
                  <div className="col-span-3 font-mono text-sm text-gray-600 truncate">
                    {company || '-'}
                  </div>
                  <div className="col-span-2">
                    <span
                      className={`font-mono text-xs uppercase px-2 py-1 ${
                        resume.processing_status === 'ready'
                          ? 'bg-green-100 text-green-700'
                          : resume.processing_status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : resume.processing_status === 'processing'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {resume.processing_status}
                    </span>
                  </div>
                  <div className="col-span-3 text-right font-mono text-xs text-gray-500">
                    {formatDate(resume.updated_at || resume.created_at)}
                  </div>
                </div>
              );
            })}
            {filteredAndSortedResumes.length === 0 && (
              <div className="py-8 text-center text-gray-500 font-mono text-sm">
                {t('dashboard.noResults') || 'No resumes match your filters'}
              </div>
            )}
          </div>
        )}

        {/* 3. Create Tailored Resume */}
        <Card className="aspect-square h-full" variant="default">
          <div className="flex-1 flex flex-col items-center justify-center text-center h-full">
            <Button
              onClick={() => router.push('/tailor')}
              disabled={!isTailorEnabled}
              className="w-20 h-20 bg-blue-700 text-white border-2 border-black shadow-sw-default hover:bg-blue-800 hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-none transition-all rounded-none"
            >
              <Plus className="w-8 h-8" />
            </Button>
            <p className="text-xs font-mono mt-4 uppercase text-green-700">
              {t('dashboard.createResume')}
            </p>
          </div>
        </Card>

        {/* 4. Fillers */}
        {Array.from({ length: fillerCount }).map((_, index) => (
          <Card
            key={`filler-${index}`}
            variant="ghost"
            noPadding
            className="hidden md:block bg-canvas aspect-square h-full opacity-50 pointer-events-none"
          />
        ))}

        {Array.from({ length: extraFillerCount }).map((_, index) => (
          <Card
            key={`extra-filler-${index}`}
            variant="ghost"
            noPadding
            className={`hidden md:block ${fillerPalette[index % fillerPalette.length]} aspect-square h-full opacity-70 pointer-events-none`}
          />
        ))}

        <ConfirmDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          title={t('confirmations.deleteMasterResumeTitle')}
          description={t('confirmations.deleteMasterResumeDescription')}
          confirmLabel={t('dashboard.deleteAndReupload')}
          cancelLabel={t('confirmations.keepResumeCancelLabel')}
          onConfirm={confirmDeleteAndReupload}
          variant="danger"
        />
      </SwissGrid>
    </div>
  );
}
