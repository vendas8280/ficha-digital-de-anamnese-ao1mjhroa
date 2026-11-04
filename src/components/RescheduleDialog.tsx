import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarClock, Loader2 } from 'lucide-react'
import { ProcedureAppointmentRecord, appointmentsService } from '@/services/forms'
import { useToast } from '@/hooks/use-toast'
import { extractDateKey, extractTimeKey } from '@/lib/agendaHelpers'

interface RescheduleDialogProps {
  appointment: ProcedureAppointmentRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function RescheduleDialog({
  appointment,
  open,
  onOpenChange,
  onSuccess,
}: RescheduleDialogProps) {
  const { toast } = useToast()
  const [date, setDate] = useState(() =>
    appointment ? extractDateKey(appointment.procedure_date) : '',
  )
  const [time, setTime] = useState(() =>
    appointment ? extractTimeKey(appointment.procedure_time) : '09:00',
  )
  const [loading, setLoading] = useState(false)

  // Sincroniza quando abre
  const handleOpenChange = (openState: boolean) => {
    if (openState && appointment) {
      setDate(extractDateKey(appointment.procedure_date))
      setTime(extractTimeKey(appointment.procedure_time))
    }
    onOpenChange(openState)
  }

  const handleSave = async () => {
    if (!appointment) return
    if (!date.trim()) {
      toast({
        title: 'Data obrigatória',
        description: 'Selecione a nova data do atendimento.',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      await appointmentsService.rescheduleAppointment(
        appointment.id,
        date.trim(),
        time.trim() || undefined,
      )
      toast({
        title: 'Atendimento remarcado',
        description: 'Data e horário atualizados com sucesso.',
      })
      onSuccess()
      onOpenChange(false)
    } catch {
      toast({
        title: 'Erro ao remarcar',
        description: 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#6B3FA0]" />
            Remarcar Atendimento
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {appointment?.patient_name
              ? `Paciente: ${appointment.patient_name}`
              : 'Selecione a nova data e horário.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reschedDate" className="text-xs font-semibold text-slate-800">
              Nova data
            </Label>
            <Input
              id="reschedDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reschedTime" className="text-xs font-semibold text-slate-800">
              Novo horário
            </Label>
            <Input
              id="reschedTime"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading}
            className="bg-[#6B3FA0] hover:bg-[#583385] text-white text-xs gap-1.5 font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </>
            ) : (
              'Confirmar Remarcação'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
