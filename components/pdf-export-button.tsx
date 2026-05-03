'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface PDFExportButtonProps {
  customerName: string
  elementId: string
}

export default function PDFExportButton({ customerName, elementId }: PDFExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportPDF = async () => {
    const element = document.getElementById(elementId)
    if (!element) {
      console.error('Element not found:', elementId)
      alert('차트 요소를 찾을 수 없습니다.')
      return
    }

    setIsExporting(true)

    try {
      console.log('Starting PDF export...')

      // Dynamically import libraries
      const html2canvas = (await import('html2canvas')).default
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.jsPDF

      console.log('Libraries imported successfully')

      // Capture the chart as an image with high quality
      console.log('Capturing chart element...')
      const captureOptions = {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#1e293b', // slate-800
        logging: false,
        imageTimeout: 0,
      } as Parameters<typeof html2canvas>[1]
      const canvas = await html2canvas(element, captureOptions)

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 210 // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      console.log(`Chart captured: ${canvas.width}x${canvas.height}px, PDF size: ${imgWidth}x${imgHeight}mm`)

      // Create PDF with appropriate dimensions
      const orientation = imgHeight > imgWidth ? 'portrait' : 'landscape'
      const pdf = new jsPDF({
        orientation: orientation as 'portrait' | 'landscape',
        unit: 'mm',
        format: 'a4',
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      console.log(`PDF created: ${pdfWidth}x${pdfHeight}mm (${orientation})`)

      // Add title and metadata
      pdf.setFont('Helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.text(`${customerName} - 간트 차트`, 15, 15)

      pdf.setFont('Helvetica', 'normal')
      pdf.setFontSize(9)
      const now = new Date()
      const dateStr = now.toLocaleDateString('ko-KR')
      pdf.text(`생성일: ${dateStr}`, 15, 23)

      // Add chart image
      let yPosition = 30
      let remainingHeight = imgHeight

      // Handle multi-page PDF if chart is very tall
      while (remainingHeight > 0) {
        const availableHeight = pdfHeight - yPosition - 10
        const currentHeight = Math.min(remainingHeight, availableHeight)
        const sourceHeight = (currentHeight * canvas.height) / imgHeight
        const sourceY = (imgHeight - remainingHeight) * (canvas.height / imgHeight)

        // Create temporary canvas for cropped image
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = canvas.width
        tempCanvas.height = Math.ceil(sourceHeight)
        const ctx = tempCanvas.getContext('2d')
        if (!ctx) throw new Error('Failed to get canvas context')

        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sourceHeight,
          0,
          0,
          canvas.width,
          sourceHeight
        )

        const croppedImgData = tempCanvas.toDataURL('image/png')
        pdf.addImage(croppedImgData, 'PNG', 15, yPosition, pdfWidth - 30, currentHeight)

        remainingHeight -= currentHeight
        yPosition = 10

        if (remainingHeight > 0) {
          pdf.addPage()
        }
      }

      // Save and download
      const fileName = `${customerName}_간트차트.pdf`
      console.log(`Saving PDF as ${fileName}...`)
      pdf.save(fileName)

      console.log('PDF exported successfully')
      alert('간트 차트가 PDF로 성공적으로 내보내졌습니다!')

    } catch (error) {
      console.error('PDF export failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      alert(`PDF 내보내기에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button 
      onClick={handleExportPDF} 
      variant="outline" 
      size="sm" 
      disabled={isExporting}
    >
      <Download className="mr-2 h-4 w-4" />
      {isExporting ? '내보내는 중...' : 'PDF 내보내기'}
    </Button>
  )
}