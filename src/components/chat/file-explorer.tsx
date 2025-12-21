interface FileExplorerProps {
  files?: Array<{ id: string; path: string; content: string }>;
  selectedFile: { id: string; path: string; content: string } | null;
  onSelectFile: (file: { id: string; path: string; content: string }) => void;
}

export function FileExplorer({ files, selectedFile, onSelectFile }: FileExplorerProps) {
  return (
    <div className="flex-1 overflow-hidden flex">
      {/* File List */}
      <div className="w-64 border-r border-white/5 overflow-y-auto bg-[#0a0a0a]">
         {files && files.length > 0 ? (
            files.map((file) => (
              <div 
                 key={file.id} 
                 onClick={() => onSelectFile(file)}
                 className={`p-3 text-sm cursor-pointer hover:bg-white/5 truncate ${selectedFile?.id === file.id ? 'bg-white/5 text-blue-400' : 'text-gray-400'}`}
              >
                 {file.path.split('/').pop()}
              </div>
            ))
         ) : (
            <div className="p-4 text-xs text-center text-gray-600">No files generated yet.</div>
         )}
      </div>
      
      {/* File Preview */}
      <div className="flex-1 overflow-y-auto bg-[#0c0c0c] p-4 font-mono text-sm text-gray-300">
         {selectedFile ? (
            <pre className="whitespace-pre-wrap">{selectedFile.content}</pre>
         ) : (
            <div className="h-full flex items-center justify-center text-gray-600">Select a file to view content</div>
         )}
      </div>
    </div>
  );
}
