import { MessageScreen } from './Screen'

export function EnvError({ missing }: { missing: string[] }) {
  return (
    <MessageScreen title="Environment ગોઠવાયું નથી">
      <p>
        પ્રોજેક્ટ ફોલ્ડરમાં <code className="font-mono">.env</code> ફાઇલ બનાવો અને નીચેના variables ભરો. પછી{' '}
        <code className="font-mono">npm run dev</code> ફરી શરૂ કરો.
      </p>
      <ul className="list-inside list-disc font-mono text-sm">
        {missing.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <p className="text-sm">
        Missing environment variables. Copy <code className="font-mono">.env.example</code> to{' '}
        <code className="font-mono">.env</code>, fill the values and restart the dev server.
      </p>
    </MessageScreen>
  )
}
