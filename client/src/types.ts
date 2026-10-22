export const ESTADOS = [
  'Recibido',
  'En revisión',
  'En proceso',
  'Pendiente',
  'Listo para entregar',
  'Entregado',
  'Retirado',
] as const;
export type Estado = (typeof ESTADOS)[number];

export type TipoDisco = 'HDD' | 'SSD' | 'OTRO' | 'NO_ESPECIFICADO';

export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  indicador: string;
  estacion: string;
  rol: 'admin' | 'analista';
  equipos?: number;
}

export interface Equipo {
  id: number;
  numero_registro: number;
  fecha_ingreso: string;
  usuario_propietario: string;
  etiqueta: string;
  modelo: string;
  mac: string;
  nombre_equipo: string;
  analista_id: number;
  analista: string;
  analista_indicador: string;
  estacion: string;
  tipo_disco: TipoDisco;
  capacidad_disco: string;
  ram: string;
  estado: Estado;
  observaciones: string;
  fecha_salida: string | null;
  retirado_por: string | null;
  salida_observaciones: string | null;
  entregado_por: string | null;
  actividades_hechas: number;
  actividades_detalle: string | null;
}

export interface ListaEquipos {
  items: Equipo[];
  total: number;
  pagina: number;
  por_pagina: number;
  total_actividades: number;
}

export interface ActividadEquipo {
  id: number;
  orden: number;
  nombre: string;
  categoria: string;
  activa: boolean;
  completada: boolean;
  completada_en: string | null;
  analista: string | null;
}

export interface Actividad {
  id: number;
  orden: number;
  nombre: string;
  categoria: string;
  activa: boolean;
  usos: number;
}

export interface Evento {
  id: number;
  tipo: 'INGRESO' | 'EDICION' | 'ACTIVIDAD' | 'ESTADO' | 'SALIDA';
  descripcion: string;
  fecha: string;
  usuario: string;
}

export interface DetalleEquipo {
  equipo: Equipo;
  actividades: ActividadEquipo[];
  historial: Evento[];
  total_actividades: number;
  puede_operar: boolean;
  puede_editar: boolean;
}

export interface Catalogos {
  analistas: { id: number; nombre: string }[];
  estaciones: string[];
}
