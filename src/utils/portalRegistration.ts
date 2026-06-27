import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { dedupeCnpjs } from './cnpjList';
import { normalizeCNPJ } from './orders';
import { notifyFinanceiroCadastro } from './notifyService';

export type PortalRegistrationStatus = 'PENDENTE' | 'ATIVO' | 'REVOGADO';

export interface PortalRegistration {
  email: string;
  nome: string;
  cnpj: string;
  cnpjsAdicionais: string[];
  nomeContato: string;
  sobrenomeContato: string;
  notifyEmail: boolean;
  status: PortalRegistrationStatus;
  uid: string;
  approvedBy?: string;
  approvedAt?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function parseAdditionalCnpjs(data: Record<string, unknown>): string[] {
  const raw = data.cnpjsAdicionais ?? data.additionalCnpjs;
  if (Array.isArray(raw)) {
    return dedupeCnpjs(raw.map(String));
  }
  if (typeof raw === 'string' && raw.trim()) {
    return dedupeCnpjs(raw.split(/[,;]/));
  }
  return [];
}

function mapDoc(id: string, data: Record<string, unknown>): PortalRegistration {
  const primary = normalizeCNPJ(String(data.cnpj ?? ''));
  const extras = parseAdditionalCnpjs(data).filter((c) => c !== primary);
  return {
    email: String(data.email ?? ''),
    nome: String(data.nome ?? ''),
    cnpj: primary,
    cnpjsAdicionais: extras,
    nomeContato: String(data.nomeContato ?? ''),
    sobrenomeContato: String(data.sobrenomeContato ?? ''),
    notifyEmail: data.notifyEmail !== false,
    status: (String(data.status ?? 'PENDENTE').toUpperCase() as PortalRegistrationStatus) || 'PENDENTE',
    uid: String(data.uid ?? id),
    approvedBy: data.approvedBy ? String(data.approvedBy) : undefined,
    approvedAt: data.approvedAt ? String(data.approvedAt) : undefined,
  };
}

export function allCnpjsFromPortalRegistration(reg: PortalRegistration): string[] {
  return dedupeCnpjs([reg.cnpj, ...reg.cnpjsAdicionais]);
}

export async function savePortalRegistration(input: {
  uid: string;
  email: string;
  nome: string;
  nomeContato: string;
  sobrenomeContato: string;
  cnpj: string;
  additionalCnpjs?: string[];
  notifyEmail: boolean;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const cnpj = normalizeCNPJ(input.cnpj);
  if (cnpj.length !== 14) throw new Error('Informe um CNPJ válido (14 dígitos).');
  const cnpjsAdicionais = dedupeCnpjs(input.additionalCnpjs ?? []).filter((c) => c !== cnpj);
  for (const extra of cnpjsAdicionais) {
    if (extra.length !== 14) throw new Error('Informe CNPJs válidos (14 dígitos) em todos os campos.');
  }
  if (email.endsWith('@binsight.com.br')) {
    throw new Error('Use e-mail da empresa do cliente, não @binsight.com.br.');
  }

  const ref = doc(db, 'portalRegistrations', input.uid);
  const existingSnap = await getDoc(ref);
  const payload = {
    email,
    nome: input.nome.trim(),
    cnpj,
    cnpjsAdicionais,
    nomeContato: input.nomeContato.trim(),
    sobrenomeContato: input.sobrenomeContato.trim(),
    notifyEmail: input.notifyEmail !== false,
    status: 'PENDENTE' as const,
    uid: input.uid,
    createdAt: serverTimestamp(),
  };

  if (existingSnap.exists()) {
    const prev = existingSnap.data()?.status;
    if (String(prev).toUpperCase() !== 'REVOGADO') {
      throw new Error('Já existe um cadastro para esta conta. Entre ou aguarde aprovação.');
    }
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, payload);
  }

  void notifyFinanceiroCadastro({
    email,
    nome: input.nome.trim(),
    cnpj,
    additionalCnpjs: cnpjsAdicionais,
    notifyEmail: input.notifyEmail !== false,
  });
}

export async function fetchPortalRegistrationByUid(uid: string): Promise<PortalRegistration | null> {
  const snap = await getDoc(doc(db, 'portalRegistrations', uid));
  if (!snap.exists()) return null;
  return mapDoc(uid, snap.data() as Record<string, unknown>);
}

export async function fetchPortalRegistrationByEmail(email: string): Promise<PortalRegistration | null> {
  try {
    const q = query(
      collection(db, 'portalRegistrations'),
      where('email', '==', normalizeEmail(email))
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return mapDoc(d.id, d.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function fetchPendingPortalRegistrations(): Promise<PortalRegistration[]> {
  const q = query(collection(db, 'portalRegistrations'), where('status', '==', 'PENDENTE'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d.id, d.data() as Record<string, unknown>));
}

export async function setPortalRegistrationStatus(
  uid: string,
  status: PortalRegistrationStatus,
  approvedBy?: string
): Promise<void> {
  const ref = doc(db, 'portalRegistrations', uid);
  await updateDoc(ref, {
    status,
    ...(approvedBy && status === 'ATIVO'
      ? { approvedBy, approvedAt: todayBR() }
      : {}),
  });
}

export function portalRegistrationToAccessRecord(reg: PortalRegistration) {
  return {
    email: reg.email,
    nome: reg.nome,
    cnpj: reg.cnpj,
    status: reg.status,
    aprovadoPor: reg.approvedBy ?? '',
    dataAprovacao: reg.approvedAt ?? '',
    cnpjsAdicionais: reg.cnpjsAdicionais,
    notifyEmail: reg.notifyEmail,
    nomeContato: reg.nomeContato,
    sobrenomeContato: reg.sobrenomeContato,
    firestoreUid: reg.uid,
  };
}
