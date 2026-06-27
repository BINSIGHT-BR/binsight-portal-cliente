import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Banner compacto — só quando admin já está na visão cliente. */
export default function AdminClientPreviewBar() {
  const { clientPreview, stopClientPreview, isViewingAsClient } = useAuth();
  const navigate = useNavigate();

  if (!isViewingAsClient || !clientPreview) return null;

  return (
    <div className="bg-indigo-50 border-b border-indigo-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2 text-xs">
        <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
        <span className="text-indigo-800">
          Visão cliente: <strong>{clientPreview.nome}</strong> ({clientPreview.email})
        </span>
        <button
          type="button"
          onClick={() => {
            stopClientPreview();
            navigate('/admin/acessos');
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-800 font-semibold hover:bg-indigo-100"
        >
          <EyeOff className="w-3.5 h-3.5" />
          Sair da visualização
        </button>
      </div>
    </div>
  );
}
