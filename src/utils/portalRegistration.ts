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
import { normalizeCNPJ } from './orders';
import { notifyFinanceiroCadastro } from './notifyService';

export type PortalRegistrationStatus = 'PENDENTE' | 'ATIVO' | 'REVOGADO';

export interface PortalRegistration {
  email: string;
  nome: string;
  cnpj: string;
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

function mapDoc(id: string, data: Record<string, unknown>): PortalRegistration {
  return {
    email: String(data.email ?? ''),
    nome: String(data.nome ?? ''),
    cnpj: normalizeCNPJ(String(data.cnpj ?? '')),
    nomeContato: String(data.nomeContato ?? ''),
    sobrenomeContato: String(data.sobrenomeContato ?? ''),
    notifyEmail: data.notifyEmail !== false,
    status: (String(data.status ?? 'PENDENTE').toUpperCase() as PortalRegistrationStatus) || 'PENDENTE',
    uid: String(data.uid ?? id),
    approvedBy: data.approvedBy ? String(data.approvedBy) : undefined,
    approvedAt: data.approvedAt ? String(data.approvedAt) : undefined,
  };
}

export async function savePortalRegistration(input: {
  uid: string;
  email: string;
  nome: string;
  nomeContato: string;
  sobrenomeContato: string;
  cnpj: string;
  notifyEmail: boolean;
}): Promise<void> {
  const email = normalizeEmail(input.email);
  const cnpj = normalizeCNPJ(input.cnpj);
  if (cnpj.length !== 14) throw new Error('Informe um CNPJ válido (14 dígitos).');
  if (email.endsWith('@binsight.com.br')) {
    throw new Error('Use e-mail da empresa do cliente, não @binsight.com.br.');
  }

  const ref = doc(db, 'portalRegistrations', input.uid);
  const existingSnap = await getDoc(ref);
  const payload = {
    email,
    nome: input.nome.trim(),
    cnpj,
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
    cnpjsAdicionais: [] as string[],
    notifyEmail: reg.notifyEmail,
    nomeContato: reg.nomeContato,
    sobrenomeContato: reg.sobrenomeContato,
    firestoreUid: reg.uid,
  };
}
