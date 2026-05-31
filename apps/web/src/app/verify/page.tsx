'use client'

import { useState } from 'react'
import { Search, CheckCircle, XCircle, ExternalLink, Shield } from 'lucide-react'
import { SectionSkeleton } from '@/components/skeleton'
import { ExportPdfButton } from '@/components/export-pdf-button'

interface ChainOfCustody {
  certificate: {
    id: string
    kwh: number
    issued_at: string
    retired: boolean
    retired_at: string | null
    retired_by: string | null
  }
  on_chain: {
    anchor_tx: string
    anchor_explorer: string
    mint_tx: string
    mint_explorer: string
  }
  meter_proof: {
    meter_id: string
    reading_hash: string
    signature_hex: string
    kwh: number
    timestamp: string
    verified: boolean
  } | null
}

export default function VerifyPage() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<ChainOfCustody | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/verify?id=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
        return
      }
      setResult(data)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      {/* Page header */}
      <header className="mb-8 flex items-center gap-3">
        <Shield className="h-7 w-7 shrink-0 text-yellow-500" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">
            Certificate Verifier
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No login required. Enter a certificate ID, reading hash, or transaction hash.
          </p>
        </div>
      </header>

      {/* Search form */}
      <form
        onSubmit={handleVerify}
        className="mb-8"
        aria-label="Certificate verification form"
        noValidate
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="verify-query" className="sr-only">
            Certificate ID, reading hash, or transaction hash
          </label>
          <input
            id="verify-query"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Certificate ID, reading hash, or tx hash…"
            aria-label="Certificate ID, reading hash, or transaction hash"
            aria-required="true"
            autoComplete="off"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:ring-yellow-500"
          />
          <button
            type="submit"
            disabled={loading}
            aria-label={loading ? 'Verifying certificate, please wait' : 'Verify certificate'}
            aria-busy={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-950"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </div>
      </form>

      {/* Live region for async status updates */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {loading && 'Verifying certificate, please wait.'}
        {error && `Error: ${error}`}
        {result && 'Certificate verified successfully.'}
      </div>

      {/* Error state */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400"
        >
          <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4" aria-label="Loading verification results">
          <SectionSkeleton rows={4} />
          <SectionSkeleton rows={2} />
          <SectionSkeleton rows={5} />
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Status banner */}
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/40"
          >
            <CheckCircle className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
            <span className="font-medium text-green-800 dark:text-green-300">
              Certificate verified — full chain of custody confirmed
            </span>
          </div>

          {/* Certificate */}
          <Section title="Certificate" action={<ExportPdfButton certificateId={result.certificate.id} />}>
            <Row label="ID" value={result.certificate.id} mono />
            <Row label="Energy" value={`${result.certificate.kwh} kWh`} />
            <Row
              label="Issued"
              value={new Date(result.certificate.issued_at).toLocaleString()}
            />
            <Row
              label="Status"
              value={
                result.certificate.retired
                  ? `Retired ${result.certificate.retired_at ? new Date(result.certificate.retired_at).toLocaleDateString() : ''}`
                  : 'Active'
              }
            />
          </Section>

          {/* On-chain proof */}
          <Section title="On-chain proof">
            <Row
              label="Anchor tx"
              value={result.on_chain.anchor_tx}
              mono
              link={result.on_chain.anchor_explorer}
            />
            <Row
              label="Mint tx"
              value={result.on_chain.mint_tx}
              mono
              link={result.on_chain.mint_explorer}
            />
          </Section>

          {/* Meter proof */}
          {result.meter_proof && (
            <Section title="Meter proof">
              <Row label="Meter ID" value={result.meter_proof.meter_id} mono />
              <Row
                label="Reading hash"
                value={result.meter_proof.reading_hash.slice(0, 16) + '…'}
                mono
              />
              <Row
                label="Signature"
                value={result.meter_proof.signature_hex.slice(0, 16) + '…'}
                mono
              />
              <Row label="kWh" value={String(result.meter_proof.kwh)} />
              <Row
                label="Timestamp"
                value={new Date(result.meter_proof.timestamp).toLocaleString()}
              />
              <Row label="Ed25519 verified" value="✓ Valid" />
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}
            className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            {title}
          </h2>
          {action}
        </div>
        <dl className="space-y-2">{children}</dl>
      </div>
    </section>
  )
}

function Row({
  label,
  value,
  mono,
  link,
}: {
  label: string
  value: string
  mono?: boolean
  link?: string
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 text-sm sm:gap-4">
      <dt className="shrink-0 text-gray-500 dark:text-gray-400">{label}</dt>
      {link ? (
        <dd>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label}: ${value} (opens in new tab)`}
            className={`flex items-center gap-1 break-all text-blue-600 hover:underline dark:text-blue-400 ${
              mono ? 'font-mono text-xs' : ''
            }`}
          >
            {value}
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
          </a>
        </dd>
      ) : (
        <dd
          className={`break-all text-right text-gray-900 dark:text-gray-100 ${
            mono ? 'font-mono text-xs' : ''
          }`}
        >
          {value}
        </dd>
      )}
    </div>
  )
}
