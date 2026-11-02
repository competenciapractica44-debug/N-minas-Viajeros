import { ExtraConcept } from '../types';

export const DEFAULT_EXTRAS: ExtraConcept[] = [
  {
    id: 'extra-1',
    name: 'Limpieza profunda de cabina y maleteros',
    amount: 30.00,
    unit: 'servicio',
    description: 'Aplicable en viajes discrecionales o fines de semana si no hay personal de cochera.',
    tags: ['Fuera de convenio', 'Importe fijo'],
    active: true,
    isTaxable: true,
  },
  {
    id: 'extra-2',
    name: 'Hora de espera en parada/hotel discrecional',
    amount: 22.50,
    unit: 'hora',
    description: 'Para tiempos de inmovilización del autocar por orden del cliente superiores a 2h.',
    tags: ['Por hora', 'Facturable'],
    active: true,
    isTaxable: true,
  },
  {
    id: 'extra-3',
    name: 'Conducción en nieve / montaje de cadenas',
    amount: 45.00,
    unit: 'dia',
    description: 'Plus compensatorio por condiciones meteorológicas adversas y montaje de cadenas.',
    tags: ['Plus meteorológico'],
    active: true,
    isTaxable: true,
  },
  {
    id: 'extra-4',
    name: 'Gratificación refuerzo imprevisto sin 24h preaviso',
    amount: 35.00,
    unit: 'fijo',
    description: 'Plus fijo excepcional por llamada de urgencia o cobertura imprevista.',
    tags: ['Llamada de urgencia'],
    active: true,
    isTaxable: true,
  },
  {
    id: 'extra-5',
    name: 'Dieta especial cena ruta internacional',
    amount: 28.00,
    unit: 'servicio',
    description: 'Dieta fija suplementaria para servicios transfronterizos o internacionales.',
    tags: ['Internacional', 'Dietas'],
    active: true,
    isTaxable: false, // Dieta exenta de IRPF/SS dentro de límites reglamentarios
  },
];
