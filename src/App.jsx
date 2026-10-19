import HypergraphViewer from './components/HypergraphViewer'
import { I18nProvider } from './i18n.jsx'

function App() {
  return (
    <I18nProvider>
      <HypergraphViewer />
    </I18nProvider>
  )
}

export default App
