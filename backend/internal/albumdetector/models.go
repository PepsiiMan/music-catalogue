package albumdetector

type Album struct {
	Title       string `json:"title"`
	Artist      string `json:"artist"`
	Row         int    `json:"row"`
	Col         int    `json:"col"`
	SourceFrame int    `json:"source_frame"`
}

type DetectionResult struct {
	Albums              []Album `json:"albums"`
	TotalFramesProcessed int    `json:"total_frames_processed"`
	FramesWithDetections int    `json:"frames_with_detections"`
}