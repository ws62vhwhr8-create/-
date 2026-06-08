'use client'

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Download } from "lucide-react"
import { format, differenceInDays, startOfDay, min, max } from "date-fns"
import { ko } from "date-fns/locale"
import type { Milestone, Customer } from "@/lib/types"

const getStatusColor = (status: Milestone['status']) => {
  switch (status) {
    case 'completed': return 'bg-chart-1'
    case 'in-progress': return 'bg-chart-2'
    case 'overdue': return 'bg-chart-5'
    default: return 'bg-muted-foreground/30'
  }
}

const getStatusBarStyle = (status: Milestone['status']) => {
  switch (status) {
    case 'completed':
      return { backgroundColor: '#4ade80', borderColor: '#22c55e' }
    case 'in-progress':
      return { backgroundColor: '#60a5fa', borderColor: '#3b82f6' }
    case 'overdue':
      return { backgroundColor: '#f87171', borderColor: '#ef4444' }
    default:
      return { backgroundColor: '#64748b', borderColor: '#475569' }
  }
}

export default function GanttChart({ customer }: { customer: Customer }) {
  const [isExporting, setIsExporting] = useState(false)

  const milestones = customer.milestones
  
  const dates = milestones.flatMap(m => [m.dueDate, m.notifyDate])
  const minDate = min([customer.salesStartDate, ...dates])
  const maxDate = max(dates)
  const totalDays = Math.max(differenceInDays(maxDate, minDate), 1)

  // 시작일 + 각 워크플로우 시작일(= 이전 단계 종료일) + 종료일
  const allDateLabels = [
    { date: customer.salesStartDate, pos: 0 },
    ...milestones.map((m) => ({
      date: m.dueDate,
      pos: (differenceInDays(m.dueDate, minDate) / totalDays) * 100,
    })),
  ]

  // 겹침 방지: 이전 표시 레이블과 MIN_LABEL_GAP(%) 이상 떨어진 레이블만 유지
  // 마지막 레이블은 항상 표시 (너무 가까우면 직전 레이블을 대체)
  const MIN_LABEL_GAP = 9
  const dateLabels: typeof allDateLabels = []
  for (let i = 0; i < allDateLabels.length; i++) {
    const item = allDateLabels[i]
    const isLast = i === allDateLabels.length - 1
    if (i === 0) {
      dateLabels.push(item)
      continue
    }
    const lastKept = dateLabels[dateLabels.length - 1]
    if (isLast) {
      if (item.pos - lastKept.pos < MIN_LABEL_GAP) {
        dateLabels[dateLabels.length - 1] = item
      } else {
        dateLabels.push(item)
      }
    } else if (item.pos - lastKept.pos >= MIN_LABEL_GAP) {
      dateLabels.push(item)
    }
  }

  const getBarPosition = (milestone: Milestone, index: number) => {
    const prevMilestone = index > 0 ? milestones[index - 1] : null
    const startDate = prevMilestone ? prevMilestone.dueDate : customer.salesStartDate
    const startOffset = differenceInDays(startDate, minDate)
    const duration = differenceInDays(milestone.dueDate, startDate)
    
    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${Math.max((duration / totalDays) * 100, 2)}%`,
    }
  }

  const todayOffset = differenceInDays(startOfDay(new Date()), minDate)
  const todayPosition = `${(todayOffset / totalDays) * 100}%`

  const handleExportPDF = async () => {
    setIsExporting(true)

    try {
      const jsPDFModule = await import('jspdf')
      const jsPDF = jsPDFModule.jsPDF

      // --- 색상 상수 (oklch CSS 변수를 hex로 직접 지정) ---
      const COLOR = {
        bg: '#1e293b',        // slate-800
        panel: '#0f172a',     // slate-900
        rowBg: '#334155',     // slate-700
        border: '#475569',    // slate-600
        textPrimary: '#f1f5f9',  // slate-100
        textMuted: '#94a3b8',    // slate-400
        today: '#4ade80',        // chart-1 green
        completed: '#4ade80',    // chart-1
        inProgress: '#60a5fa',   // chart-2 blue
        overdue: '#f87171',      // chart-5 red
        pending: '#64748b',      // slate-500
        legendBg: '#1e293b',
      }

      const getBarColor = (status: Milestone['status']) => {
        switch (status) {
          case 'completed': return COLOR.completed
          case 'in-progress': return COLOR.inProgress
          case 'overdue': return COLOR.overdue
          default: return COLOR.pending
        }
      }

      const SCALE = 2
      const LABEL_W = 160   // 왼쪽 단계명 영역 너비 (px)
      const PAD = 24        // 전체 패딩
      const ROW_H = 38      // 행 높이
      const BAR_H = 22      // 막대 높이
      const HEADER_H = 48   // 날짜 헤더 높이
      const LEGEND_H = 40   // 범례 높이
      const TITLE_H = 60    // 제목 영역 높이

      const canvasW = 1100
      const canvasH = TITLE_H + HEADER_H + milestones.length * ROW_H + PAD * 2 + LEGEND_H

      const canvas = document.createElement('canvas')
      canvas.width = canvasW * SCALE
      canvas.height = canvasH * SCALE
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context를 생성할 수 없습니다.')
      ctx.scale(SCALE, SCALE)

      // 배경
      ctx.fillStyle = COLOR.bg
      ctx.fillRect(0, 0, canvasW, canvasH)

      // 제목
      ctx.fillStyle = COLOR.textPrimary
      ctx.font = 'bold 18px sans-serif'
      ctx.fillText(`${customer.companyName} - 간트 차트 (타임라인)`, PAD, PAD + 20)
      ctx.fillStyle = COLOR.textMuted
      ctx.font = '12px sans-serif'
      ctx.fillText(`생성일: ${new Date().toLocaleDateString('ko-KR')}`, PAD, PAD + 40)

      // 차트 영역 x 범위
      const chartX = PAD + LABEL_W
      const chartW = canvasW - PAD * 2 - LABEL_W

      // 날짜 헤더 구분선
      const headerY = TITLE_H
      ctx.strokeStyle = COLOR.border
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(PAD, headerY + HEADER_H - 1)
      ctx.lineTo(canvasW - PAD, headerY + HEADER_H - 1)
      ctx.stroke()

      // 날짜 레이블 (겹침 방지 적용된 dateLabels 재사용)
      ctx.fillStyle = COLOR.textMuted
      ctx.font = '11px sans-serif'
      dateLabels.forEach((item, index) => {
        const x = chartX + (item.pos / 100) * chartW
        const label = (index === 0 || index === dateLabels.length - 1)
          ? format(item.date, 'yyyy.MM.dd', { locale: ko })
          : format(item.date, 'MM.dd', { locale: ko })
        const textW = ctx.measureText(label).width
        const isFirst = index === 0
        const isLast = index === dateLabels.length - 1
        const offsetX = isFirst ? 0 : isLast ? -textW : -textW / 2
        ctx.fillText(label, x + offsetX, headerY + HEADER_H - 10)
      })

      // 오늘 선 위치
      const todayOffsetDays = differenceInDays(startOfDay(new Date()), minDate)
      const todayX = chartX + (todayOffsetDays / totalDays) * chartW

      // 각 마일스톤 행 그리기
      milestones.forEach((milestone, index) => {
        const rowY = headerY + HEADER_H + index * ROW_H
        const barY = rowY + (ROW_H - BAR_H) / 2

        // 행 구분선
        ctx.strokeStyle = COLOR.border
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(PAD, rowY + ROW_H)
        ctx.lineTo(canvasW - PAD, rowY + ROW_H)
        ctx.stroke()

        // 단계명
        ctx.fillStyle = COLOR.textPrimary
        ctx.font = '13px sans-serif'
        const maxLabelW = LABEL_W - 12
        let label = milestone.stageName
        while (ctx.measureText(label).width > maxLabelW && label.length > 1) {
          label = label.slice(0, -1)
        }
        if (label !== milestone.stageName) label += '…'
        ctx.fillText(label, PAD, barY + BAR_H / 2 + 4)

        // 배경 트랙
        ctx.fillStyle = COLOR.rowBg
        ctx.beginPath()
        ctx.roundRect(chartX, barY, chartW, BAR_H, 4)
        ctx.fill()

        // 컬러 막대
        const prevMilestone = index > 0 ? milestones[index - 1] : null
        const startDate = prevMilestone ? prevMilestone.dueDate : customer.salesStartDate
        const startOffset = differenceInDays(startDate, minDate)
        const duration = differenceInDays(milestone.dueDate, startDate)
        const barLeft = chartX + (startOffset / totalDays) * chartW
        const barWidth = Math.max((duration / totalDays) * chartW, 6)

        ctx.fillStyle = getBarColor(milestone.status)
        ctx.beginPath()
        ctx.roundRect(barLeft, barY, barWidth, BAR_H, 4)
        ctx.fill()
      })

      // 오늘 세로선
      if (todayOffsetDays >= 0 && todayX <= chartX + chartW) {
        const lineTop = headerY + HEADER_H - 16
        const lineBottom = headerY + HEADER_H + milestones.length * ROW_H
        ctx.strokeStyle = COLOR.today
        ctx.lineWidth = 2
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.moveTo(todayX, lineTop)
        ctx.lineTo(todayX, lineBottom)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.fillStyle = COLOR.today
        ctx.font = 'bold 11px sans-serif'
        ctx.fillText('오늘', todayX - 12, lineTop - 2)
      }

      // 범례
      const legendY = headerY + HEADER_H + milestones.length * ROW_H + PAD
      const legends = [
        { color: COLOR.completed, label: '완료' },
        { color: COLOR.inProgress, label: '진행중' },
        { color: COLOR.overdue, label: '지연' },
        { color: COLOR.pending, label: '대기' },
      ]
      let legendX = PAD + LABEL_W
      legends.forEach(({ color, label }) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.roundRect(legendX, legendY + 2, 12, 12, 3)
        ctx.fill()
        ctx.fillStyle = COLOR.textMuted
        ctx.font = '12px sans-serif'
        ctx.fillText(label, legendX + 16, legendY + 13)
        legendX += ctx.measureText(label).width + 42
      })

      // Canvas → PDF
      const imgData = canvas.toDataURL('image/png')
      const pdfOrientation = canvasW > canvasH ? 'landscape' : 'portrait'
      const pdf = new jsPDF({ orientation: pdfOrientation, unit: 'mm', format: 'a4' })
      const pdfW = pdf.internal.pageSize.getWidth()
      const pdfH = pdf.internal.pageSize.getHeight()

      const ratio = canvasH / canvasW
      const imgW = pdfW - 20
      const imgH = imgW * ratio

      if (imgH <= pdfH - 20) {
        pdf.addImage(imgData, 'PNG', 10, 10, imgW, imgH)
      } else {
        // 여러 페이지로 분할
        const pageContentH = pdfH - 20
        const sourceHPerPage = (pageContentH / imgH) * (canvas.height / SCALE)
        let srcY = 0
        while (srcY < canvas.height / SCALE) {
          const sliceH = Math.min(sourceContentH(srcY, canvas.height / SCALE, sourceHPerPage), canvas.height / SCALE - srcY)
          const sliceCanvas = document.createElement('canvas')
          sliceCanvas.width = canvas.width
          sliceCanvas.height = Math.ceil(sliceH * SCALE)
          const sliceCtx = sliceCanvas.getContext('2d')!
          sliceCtx.drawImage(canvas, 0, srcY * SCALE, canvas.width, sliceH * SCALE, 0, 0, canvas.width, sliceH * SCALE)
          const sliceImg = sliceCanvas.toDataURL('image/png')
          const sliceRenderH = (sliceH / (canvas.height / SCALE)) * imgH
          pdf.addImage(sliceImg, 'PNG', 10, 10, imgW, sliceRenderH)
          srcY += sliceH
          if (srcY < canvas.height / SCALE) pdf.addPage()
        }
      }

      pdf.save(`${customer.companyName}_간트차트.pdf`)
      toast.success('간트 차트가 PDF로 성공적으로 내보내졌습니다!')

    } catch (error) {
      console.error('PDF export failed:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(`PDF 내보내기에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsExporting(false)
    }
  }

  // 슬라이스 높이 헬퍼
  function sourceContentH(srcY: number, totalH: number, pageH: number) {
    return Math.min(pageH, totalH - srcY)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-2 flex-1">
          <span>{format(minDate, 'yyyy.MM.dd', { locale: ko })}</span>
          <span>{format(maxDate, 'yyyy.MM.dd', { locale: ko })}</span>
        </div>
        <Button
          onClick={handleExportPDF}
          variant="outline"
          size="sm"
          disabled={isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? '내보내는 중...' : 'PDF 내보내기'}
        </Button>
      </div>
      
      <div id="gantt-chart" className="relative bg-slate-800 p-5 rounded-lg border text-white min-h-96">
        {/* Date labels: 시작일, 각 워크플로우 시작일, 종료일 */}
        <div className="relative h-7 mb-3 border-b border-slate-700">
          {dateLabels.map((item, index) => {
            const isFirst = index === 0
            const isLast = index === dateLabels.length - 1
            const translate = isFirst ? '0%' : isLast ? '-100%' : '-50%'
            const label = (isFirst || isLast)
              ? format(item.date, 'yyyy.MM.dd', { locale: ko })
              : format(item.date, 'MM.dd', { locale: ko })
            return (
              <div
                key={index}
                className="absolute text-xs text-slate-300 whitespace-nowrap"
                style={{ left: `${item.pos}%`, transform: `translateX(${translate})` }}
              >
                {label}
              </div>
            )
          })}
        </div>
        
        {/* Today marker */}
        <div 
          className="absolute top-12 bottom-5 w-0.5 bg-primary z-10"
          style={{ left: todayPosition }}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-primary font-medium whitespace-nowrap bg-slate-800 px-1">
            오늘
          </div>
        </div>
        
        <div className="space-y-3">
          {milestones.map((milestone, index) => (
            <div key={milestone.id} className="flex items-center gap-3">
              <div
                className="w-36 shrink-0 text-sm truncate"
                title={milestone.stageName}
                style={{ paddingLeft: `${(milestone.stageLevel ?? 0) * 12}px` }}
              >
                {(milestone.stageLevel ?? 0) > 0 && (
                  <span className="text-slate-500 mr-1 select-none">{'└'}</span>
                )}
                {milestone.stageName}
              </div>
              <div className="flex-1 h-7 bg-slate-700 rounded relative border border-slate-600">
                <div
                  className={`absolute h-full rounded transition-all border ${getStatusColor(milestone.status)}`}
                  style={{
                    ...getBarPosition(milestone, index),
                    ...getStatusBarStyle(milestone.status),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-6 pt-6 text-xs text-slate-700 dark:text-slate-200">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: '#4ade80' }} />
          <span className="font-medium">완료</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: '#60a5fa' }} />
          <span className="font-medium">진행중</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: '#f87171' }} />
          <span className="font-medium">지연</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded" style={{ backgroundColor: '#64748b' }} />
          <span className="font-medium">대기</span>
        </div>
      </div>
    </div>
  )
}
