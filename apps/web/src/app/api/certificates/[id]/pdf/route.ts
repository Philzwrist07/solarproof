import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import { createServiceClient } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Certificate = Database['public']['Tables']['certificates']['Row']
type Reading = Pick<Database['public']['Tables']['readings']['Row'], 'meter_id' | 'timestamp'>

const ParamsSchema = z.object({
  id: z.string().uuid(),
})

/**
 * GET /api/certificates/[id]/pdf
 *
 * Generates and returns a PDF certificate with embedded QR code.
 * The QR code links to /verify/[id] for public verification.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsed = ParamsSchema.safeParse(await params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid certificate ID' }, { status: 400 })
  }
  const { id } = parsed.data

  const db = createServiceClient()

  const { data: cert } = await db
    .from('certificates')
    .select('*')
    .eq('id', id)
    .single() as { data: Certificate | null }

  if (!cert) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
  }

  const { data: reading } = await db
    .from('readings')
    .select('meter_id, timestamp')
    .eq('id', cert.reading_id)
    .single() as { data: Reading | null }

  // Generate QR code as PNG buffer
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://solarproof.vercel.app'}/verify/${id}`
  const qrPng = await QRCode.toBuffer(verifyUrl, { type: 'png', width: 150, margin: 1 })

  // Build PDF
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4
  const { width, height } = page.getSize()

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const gold = rgb(0.96, 0.62, 0.04)
  const dark = rgb(0.1, 0.1, 0.1)
  const gray = rgb(0.45, 0.45, 0.45)

  // Header bar
  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: gold })
  page.drawText('SolarProof', { x: 40, y: height - 48, size: 28, font: fontBold, color: rgb(1, 1, 1) })
  page.drawText('Renewable Energy Certificate', { x: 40, y: height - 68, size: 11, font, color: rgb(1, 1, 1) })

  // Certificate ID
  let y = height - 120
  page.drawText('Certificate ID', { x: 40, y, size: 9, font, color: gray })
  y -= 16
  page.drawText(cert.id, { x: 40, y, size: 10, font: fontBold, color: dark })

  // Divider
  y -= 20
  page.drawLine({ start: { x: 40, y }, end: { x: width - 40, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })

  // Fields
  const fields: [string, string][] = [
    ['Energy (kWh)', `${cert.kwh} kWh`],
    ['Issued', new Date(cert.issued_at).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })],
    ['Status', cert.retired ? `Retired${cert.retired_at ? ' — ' + new Date(cert.retired_at).toLocaleDateString() : ''}` : 'Active'],
    ['Meter ID', reading?.meter_id ?? '—'],
    ['Reading timestamp', reading ? new Date(reading.timestamp).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : '—'],
    ['Anchor tx', cert.anchor_tx_hash],
    ['Mint tx', cert.mint_tx_hash],
  ]

  for (const [label, value] of fields) {
    y -= 28
    page.drawText(label, { x: 40, y, size: 9, font, color: gray })
    y -= 15
    // Truncate long hashes to fit
    const display = value.length > 72 ? value.slice(0, 70) + '…' : value
    page.drawText(display, { x: 40, y, size: 10, font: fontBold, color: dark })
  }

  // QR code
  const qrImage = await pdfDoc.embedPng(qrPng)
  const qrSize = 130
  page.drawImage(qrImage, { x: width - qrSize - 40, y: height - 260, width: qrSize, height: qrSize })
  page.drawText('Scan to verify', { x: width - qrSize - 40 + 18, y: height - 275, size: 9, font, color: gray })

  // Footer
  page.drawLine({ start: { x: 40, y: 50 }, end: { x: width - 40, y: 50 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) })
  page.drawText('Verified on Stellar · solarproof.vercel.app', { x: 40, y: 34, size: 9, font, color: gray })
  page.drawText(verifyUrl, { x: 40, y: 20, size: 8, font, color: gray })

  const pdfBytes = await pdfDoc.save()

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${id.slice(0, 8)}.pdf"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
