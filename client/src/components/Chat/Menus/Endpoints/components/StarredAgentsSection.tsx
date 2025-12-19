import React, { useMemo } from 'react';
import { Star, Bot } from 'lucide-react';
import { EModelEndpoint, PermissionBits } from 'librechat-data-provider';
import type { Endpoint } from '~/common';
import { CustomMenu as Menu, CustomMenuItem as MenuItem } from '../CustomMenu';
import { useModelSelectorContext } from '../ModelSelectorContext';
import { useMarketplaceAgentsInfiniteQuery } from '~/data-provider/Agents';
import { useLocalize } from '~/hooks';

interface StarredAgentsSectionProps {
  agentsEndpoint: Endpoint | null;
}

export function StarredAgentsSection({ agentsEndpoint }: StarredAgentsSectionProps) {
  const localize = useLocalize();
  const { selectedValues, handleSelectModel, endpointSearchValues, setEndpointSearchValue } =
    useModelSelectorContext();

  const { model: selectedModel, endpoint: selectedEndpoint } = selectedValues;

  // Fetch starred agents
  const { data, isLoading, isFetching } = useMarketplaceAgentsInfiniteQuery(
    {
      requiredPermission: PermissionBits.VIEW,
      category: 'starred',
      limit: 100, // Get all starred agents
    },
    {
      enabled: !!agentsEndpoint,
      // Refetch when component becomes visible to ensure latest data
      refetchOnMount: true,
    },
  );

  // Flatten all pages into a single array of agents
  // Filter to only show currently starred agents (isStarred === true)
  // This ensures unstarred agents are removed from dropdown immediately,
  // while they remain visible in the marketplace Starred tab until refresh
  const starredAgents = useMemo(() => {
    if (!data?.pages) return [];
    const allAgents = data.pages.flatMap((page) => page.data || []);
    // Filter to only show agents that are currently starred
    return allAgents.filter((agent) => agent.isStarred === true);
  }, [data?.pages]);

  const searchValue = endpointSearchValues[EModelEndpoint.agents] || '';

  // Filter agents based on search
  const filteredAgents = useMemo(() => {
    if (!searchValue) return starredAgents;
    const lowerSearch = searchValue.toLowerCase();
    return starredAgents.filter(
      (agent) =>
        agent.name?.toLowerCase().includes(lowerSearch) ||
        agent.description?.toLowerCase().includes(lowerSearch),
    );
  }, [starredAgents, searchValue]);

  // Don't render if there's no agents endpoint
  if (!agentsEndpoint) {
    return null;
  }

  const placeholder = localize('com_endpoint_search_var', { 0: localize('com_agents_starred') });

  return (
    <Menu
      id="starred-agents-menu"
      key="starred-agents-item"
      className="transition-opacity duration-200 ease-in-out"
      defaultOpen={selectedEndpoint === EModelEndpoint.agents && starredAgents.length > 0}
      searchValue={searchValue}
      onSearch={(value) => setEndpointSearchValue(EModelEndpoint.agents, value)}
      combobox={<input placeholder={placeholder} />}
      label={
        <div className="group flex w-full flex-shrink cursor-pointer items-center justify-between rounded-xl px-1 py-1 text-sm">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 flex-shrink-0 text-yellow-500" fill="currentColor" />
            <span className="truncate text-left">{localize('com_agents_starred')}</span>
          </div>
        </div>
      }
    >
      {(() => {
        if (isLoading || isFetching) {
          return (
            <div className="flex items-center justify-center p-2">
              <span className="text-sm text-text-secondary">{localize('com_agents_loading')}</span>
            </div>
          );
        }
        if (filteredAgents.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <Star className="mb-2 h-8 w-8 text-text-secondary" />
              <p className="text-sm font-medium text-text-primary">
                {localize('com_agents_starred_empty')}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {localize('com_agents_starred_empty_description')}
              </p>
            </div>
          );
        }
        return filteredAgents.map((agent) => {
          const isSelected =
            selectedEndpoint === EModelEndpoint.agents && selectedModel === agent.id;
          const avatarUrl = agentsEndpoint?.modelIcons?.[agent.id ?? ''] || null;
          const agentName = agentsEndpoint?.agentNames?.[agent.id] || agent.name || agent.id;

          return (
            <MenuItem
              key={agent.id}
              onClick={() => handleSelectModel(agentsEndpoint, agent.id)}
              className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2 text-sm"
            >
              <div className="flex w-full min-w-0 items-center gap-2 px-1 py-1">
                {(() => {
                  if (avatarUrl) {
                    return (
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
                        <img
                          src={avatarUrl}
                          alt={agentName}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    );
                  }
                  if (agentsEndpoint.icon) {
                    return (
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full">
                        {agentsEndpoint.icon}
                      </div>
                    );
                  }
                  return (
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-secondary">
                      <Bot className="h-3 w-3 text-text-secondary" />
                    </div>
                  );
                })()}
                <span className="truncate text-left">{agentName}</span>
              </div>
              {isSelected && (
                <div className="flex-shrink-0 self-center">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="block"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12ZM16.0755 7.93219C16.5272 8.25003 16.6356 8.87383 16.3178 9.32549L11.5678 16.0755C11.3931 16.3237 11.1152 16.4792 10.8123 16.4981C10.5093 16.517 10.2142 16.3973 10.0101 16.1727L7.51006 13.4227C7.13855 13.014 7.16867 12.3816 7.57733 12.0101C7.98598 11.6386 8.61843 11.6687 8.98994 12.0773L10.6504 13.9039L14.6822 8.17451C15 7.72284 15.6238 7.61436 16.0755 7.93219Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              )}
            </MenuItem>
          );
        });
      })()}
    </Menu>
  );
}
