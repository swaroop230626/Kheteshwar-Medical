import type { DoctorOption } from '../register/api'

export type DoctorMode = 'existing' | 'new'

export interface RxDraft {
  doctorMode: DoctorMode
  doctorId: string
  doctorName: string
  doctorRegNo: string
  patientName: string
  patientAddress: string
  patientAge: string
}

export const freshRx = (): RxDraft => ({
  doctorMode: 'existing',
  doctorId: '',
  doctorName: '',
  doctorRegNo: '',
  patientName: '',
  patientAddress: '',
  patientAge: '',
})

export function isScheduled(schedule: string): boolean {
  return schedule === 'H' || schedule === 'H1' || schedule === 'X'
}

export function isStrict(schedule: string): boolean {
  return schedule === 'H1' || schedule === 'X'
}

// Same rules as supabase/create_bill_v2.sql
export function validateRx(d: RxDraft, strict: boolean, doctors: DoctorOption[]): string | null {
  if (d.doctorMode === 'existing') {
    const doc = doctors.find((x) => x.id === d.doctorId)
    if (!doc) return 'Doctor પસંદ કરો (કે "નવા doctor" પસંદ કરો).'
    if (strict && doc.regNo.trim() === '') return 'આ doctor ની registration no નોંધાયેલી નથી. "નવા doctor" માં નંબર સાથે લખો.'
  } else {
    if (d.doctorName.trim() === '') return 'Doctor નું નામ લખો.'
    if (strict && d.doctorRegNo.trim() === '') return 'Schedule H1/X માટે doctor ની registration no જરૂરી છે.'
  }
  if (d.patientName.trim() === '') return 'Patient નું નામ લખો.'
  if (strict && d.patientAddress.trim() === '') return 'Schedule H1/X માટે patient નું સરનામું જરૂરી છે.'
  return null
}

export interface RxPayload {
  doctor_id: string | null
  doctor_name: string
  doctor_reg_no: string
  patient_name: string
  patient_address: string
  patient_age: string
}

export function toPayload(d: RxDraft, doctors: DoctorOption[]): RxPayload {
  const doc = d.doctorMode === 'existing' ? doctors.find((x) => x.id === d.doctorId) : undefined
  return {
    doctor_id: doc ? doc.id : null,
    doctor_name: doc ? doc.name : d.doctorName.trim(),
    doctor_reg_no: doc ? doc.regNo : d.doctorRegNo.trim(),
    patient_name: d.patientName.trim(),
    patient_address: d.patientAddress.trim(),
    patient_age: d.patientAge.trim(),
  }
}
