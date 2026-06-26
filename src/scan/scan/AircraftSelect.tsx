// Scan entry: select aircraft → area, then launch the camera (PRD §11.1, §12.1/12.2).
// Builds the detector + detection map for the chosen area and hands off to CameraScan.

import { useEffect, useState } from 'react'
import {
  ScanArea,
  getAreas,
  getDetectionMap,
  getReferenceScan,
  ReferenceScanData,
  ScanComponent,
} from '../db/scan'
import { createGuidedDetector } from '../recognition/guidedDetector'
import { Detector } from '../recognition/detector'
import { CameraScan } from './CameraScan'
import { ReferenceScan } from './ReferenceScan'

type Launch =
  | { mode: 'camera'; detector: Detector; detectionMap: Map<string, ScanComponent> }
  | { mode: 'reference'; data: ReferenceScanData }

export function AircraftSelect() {
  const [areas, setAreas] = useState<ScanArea[]>([])
  const [loading, setLoading] = useState(true)
  const [aircraft, setAircraft] = useState<string | null>(null)
  const [launch, setLaunch] = useState<Launch | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    let active = true
    getAreas()
      .then((data) => active && setAreas(data))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const aircraftList = Array.from(new Set(areas.map((a) => a.aircraft)))
  const areasForAircraft = areas.filter((a) => a.aircraft === aircraft)

  async function startScan(area: ScanArea) {
    setStarting(true)
    try {
      // Areas with a reference photo use reference-image mode (fixed backdrop +
      // hotspots). Otherwise fall back to live-camera guided recognition; CV
      // swaps in behind the same Detector seam once a model exists.
      if (area.reference_image_url) {
        const data = await getReferenceScan(area.aircraft, area.area)
        if (data) {
          setLaunch({ mode: 'reference', data })
          return
        }
      }
      const detector = createGuidedDetector(area.aircraft, area.area)
      const detectionMap = await getDetectionMap(area.aircraft, area.area)
      setLaunch({ mode: 'camera', detector, detectionMap })
    } finally {
      setStarting(false)
    }
  }

  if (launch) {
    return launch.mode === 'reference' ? (
      <ReferenceScan data={launch.data} onExit={() => setLaunch(null)} />
    ) : (
      <CameraScan
        detector={launch.detector}
        detectionMap={launch.detectionMap}
        onExit={() => setLaunch(null)}
      />
    )
  }

  if (loading) {
    return <p className="text-slate-500 text-sm text-center py-10">Loading…</p>
  }

  return (
    <div className="px-5 py-6 max-w-lg mx-auto w-full">
      {!aircraft ? (
        <>
          <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-3">Select aircraft</h2>
          {aircraftList.length === 0 ? (
            <p className="text-slate-500 text-sm">No aircraft configured yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {aircraftList.map((ac) => (
                <button
                  key={ac}
                  onClick={() => setAircraft(ac)}
                  className="w-full text-left p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-emerald-500 text-white font-medium transition"
                >
                  {ac}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => setAircraft(null)}
            className="text-xs text-slate-400 hover:text-white mb-4"
          >
            ← {aircraft}
          </button>
          <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-3">Select area</h2>
          <div className="flex flex-col gap-2">
            {areasForAircraft.map((a) => (
              <button
                key={a.id}
                disabled={starting}
                onClick={() => startScan(a)}
                className="w-full text-left p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-emerald-500 disabled:opacity-50 transition"
              >
                <p className="text-white font-medium">{a.area}</p>
                {a.system && <p className="text-xs text-slate-400 mt-0.5">{a.system}</p>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
