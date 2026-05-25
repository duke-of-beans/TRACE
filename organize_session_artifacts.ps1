# Run this after downloading all files from Claude to D:\Downloads
# Organizes session artifacts into their proper project locations

$downloads = "D:\Downloads"

# TRACE docs
$traceDocs = "D:\Projects\TRACE\docs"
$moireDocs = "D:\Projects\TRACE\docs\moire"

New-Item -ItemType Directory -Force -Path $traceDocs | Out-Null
New-Item -ItemType Directory -Force -Path $moireDocs | Out-Null

# TRACE core documents
Copy-Item "$downloads\TRACE_REQUIREMENTS_SYNTHESIS.md" "$traceDocs\REQUIREMENTS_SYNTHESIS.md" -Force
Copy-Item "$downloads\TRACE_SECURITY_ARCHITECTURE.md" "$traceDocs\SECURITY_ARCHITECTURE.md" -Force
Copy-Item "$downloads\TRACE_SECURITY_EDGE_CASES.md" "$traceDocs\SECURITY_EDGE_CASES.md" -Force

# MOIRÉ documents (subdirectory of TRACE)
Copy-Item "$downloads\MOIRE_FPE_Deception_Middleware_v2.pdf" "$moireDocs\MOIRE_White_Paper_v2.pdf" -Force
Copy-Item "$downloads\MOIRE_ADVERSARIAL_META_GAME.md" "$moireDocs\ADVERSARIAL_META_GAME.md" -Force
Copy-Item "$downloads\EDGE_CASE_DEEP_DIVE.md" "$moireDocs\EDGE_CASE_DEEP_DIVE.md" -Force
Copy-Item "$downloads\WHITE_PAPER_DESIGN.md" "$moireDocs\WHITE_PAPER_DESIGN.md" -Force
Copy-Item "$downloads\MOIRE_WEBSITE_PAGE_ENTRY.md" "$moireDocs\WEBSITE_PAGE_ENTRY.md" -Force

# Website redesign doc → Meta
Copy-Item "$downloads\RESEARCH_PAGE_REDESIGN.md" "D:\Meta\RESEARCH_PAGE_REDESIGN.md" -Force

Write-Host "Done. Files organized:" -ForegroundColor Green
Write-Host "  $traceDocs\REQUIREMENTS_SYNTHESIS.md"
Write-Host "  $traceDocs\SECURITY_ARCHITECTURE.md"
Write-Host "  $traceDocs\SECURITY_EDGE_CASES.md"
Write-Host "  $moireDocs\MOIRE_White_Paper_v2.pdf"
Write-Host "  $moireDocs\ADVERSARIAL_META_GAME.md"
Write-Host "  $moireDocs\EDGE_CASE_DEEP_DIVE.md"
Write-Host "  $moireDocs\WHITE_PAPER_DESIGN.md"
Write-Host "  $moireDocs\WEBSITE_PAGE_ENTRY.md"
Write-Host "  D:\Meta\RESEARCH_PAGE_REDESIGN.md"
