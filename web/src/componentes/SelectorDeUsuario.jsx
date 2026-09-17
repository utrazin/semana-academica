export default function SelectorDeUsuario({ usuarios, valor, aoTrocar }) {
  return (
    <label>
      Usuário
      <select value={valor} onChange={(evento) => aoTrocar(evento.target.value)}>
        <option value="" disabled>
          Selecione…
        </option>
        {usuarios.map((usuario) => (
          <option key={usuario.id} value={usuario.id}>
            {usuario.nome}
          </option>
        ))}
      </select>
    </label>
  );
}