import React, { useState } from 'react';
import { db } from '@/services/supabase-data';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Briefcase, 
  Clock, 
  CheckCircle2, 
  MessageSquare, 
  Trophy, 
  XCircle,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ApplicationCard from '@/components/pipeline/ApplicationCard';

const COLUMNS = [
  { id: 'saved', title: 'Saved', icon: Clock, color: 'bg-slate-500' },
  { id: 'applying', title: 'Applying', icon: Briefcase, color: 'bg-blue-500' },
  { id: 'applied', title: 'Applied', icon: CheckCircle2, color: 'bg-indigo-500' },
  { id: 'interview', title: 'Interview', icon: MessageSquare, color: 'bg-amber-500' },
  { id: 'offer', title: 'Offer', icon: Trophy, color: 'bg-emerald-500' },
  { id: 'rejected', title: 'Rejected', icon: XCircle, color: 'bg-red-500' },
];

export default function Pipeline() {
  const queryClient = useQueryClient();

  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => db.applications.list(),
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => db.jobs.list('-created_date', 200),
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => db.jobMatches.list(),
  });

  const updateApplicationMutation = useMutation({
    mutationFn: ({ id, data }) => db.applications.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  const deleteApplicationMutation = useMutation({
    mutationFn: (id) => db.applications.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['applications'] }),
  });

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;

    const app = applications.find(a => a.id === draggableId);
    if (app && app.status !== newStatus) {
      const updateData = { status: newStatus };
      
      // Auto-set applied_date when moving to applied
      if (newStatus === 'applied' && !app.applied_date) {
        updateData.applied_date = new Date().toISOString().split('T')[0];
      }

      updateApplicationMutation.mutate({ id: app.id, data: updateData });
    }
  };

  const handleStatusChange = (appId, newStatus) => {
    const updateData = { status: newStatus };
    if (newStatus === 'applied') {
      updateData.applied_date = new Date().toISOString().split('T')[0];
    }
    updateApplicationMutation.mutate({ id: appId, data: updateData });
  };

  const handleDelete = (appId) => {
    deleteApplicationMutation.mutate(appId);
  };

  // Group applications by status
  const applicationsByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.id] = applications.filter(a => a.status === col.id);
    return acc;
  }, {});

  // Calculate stats
  const totalApplied = applications.filter(a => 
    ['applied', 'interview', 'offer'].includes(a.status)
  ).length;
  const totalResponses = applications.filter(a => 
    ['interview', 'offer', 'rejected'].includes(a.status)
  ).length;
  const responseRate = totalApplied > 0 ? Math.round((totalResponses / totalApplied) * 100) : 0;

  if (appsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-full mx-auto">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="flex gap-4 overflow-x-auto">
            {[1,2,3,4,5,6].map(i => (
              <Skeleton key={i} className="w-72 h-96 flex-shrink-0" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="max-w-full mx-auto mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Application Pipeline</h1>
              <p className="text-slate-500 mt-1">
                Drag and drop to update status
              </p>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="bg-white rounded-lg px-4 py-2 border">
                <span className="text-slate-500">Total Applied:</span>
                <span className="ml-2 font-semibold text-slate-900">{totalApplied}</span>
              </div>
              <div className="bg-white rounded-lg px-4 py-2 border">
                <span className="text-slate-500">Response Rate:</span>
                <span className="ml-2 font-semibold text-slate-900">{responseRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 px-4">
            {COLUMNS.map((column) => (
              <div key={column.id} className="flex-shrink-0 w-72">
                <Card className="bg-slate-100/50 border-0">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${column.color}`} />
                        <CardTitle className="text-sm font-medium text-slate-700">
                          {column.title}
                        </CardTitle>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {applicationsByStatus[column.id]?.length || 0}
                      </Badge>
                    </div>
                  </CardHeader>
                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <CardContent
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`min-h-[400px] transition-colors ${
                          snapshot.isDraggingOver ? 'bg-slate-200/50' : ''
                        }`}
                      >
                        {applicationsByStatus[column.id]?.map((app, index) => {
                          const job = jobs.find(j => j.id === app.job_id);
                          const match = matches.find(m => m.job_id === app.job_id);
                          
                          return (
                            <Draggable
                              key={app.id}
                              draggableId={app.id}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={snapshot.isDragging ? 'opacity-90' : ''}
                                >
                                  <ApplicationCard
                                    application={app}
                                    job={job}
                                    match={match}
                                    onStatusChange={handleStatusChange}
                                    onDelete={handleDelete}
                                  />
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                        
                        {applicationsByStatus[column.id]?.length === 0 && (
                          <div className="text-center py-8 text-slate-400">
                            <p className="text-sm">No applications</p>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Droppable>
                </Card>
              </div>
            ))}
          </div>
        </DragDropContext>

        {/* Empty state */}
        {applications.length === 0 && (
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">No applications yet</h3>
            <p className="text-slate-500 mt-1">
              Save jobs from the Jobs Explorer to start tracking your applications
            </p>
            <Button asChild className="mt-4 bg-indigo-600 hover:bg-indigo-700">
              <Link to={'/jobs'}>
                <Plus className="w-4 h-4 mr-2" />
                Browse Jobs
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}